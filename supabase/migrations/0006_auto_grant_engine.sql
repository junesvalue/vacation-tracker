-- ============================================================
-- 0006_auto_grant_engine.sql
-- 한국 근로기준법 실무 근사치 — 연차 자동 부여 엔진
-- 안전성: 재실행해도 동일 결과 (idempotent). 중복 방지는 (employee_id, grant_date,
--         leave_type='annual', source='auto') 조합 unique 검사로.
-- ============================================================

-- ------------------------------------------------------------
-- 헬퍼: 근속 N년차에 부여될 연차 일수
--   1, 2년차: 15
--   3, 4년차: 16
--   5, 6년차: 17
--   ...
--   21년차+: 25 (상한)
-- ------------------------------------------------------------
create or replace function vacation_tracker.annual_days_for_years(p_years int)
returns numeric
language sql
immutable
as $$
  select case
    when p_years < 1 then 0::numeric
    when p_years < 3 then 15::numeric
    else least(15 + ((p_years - 3) / 2 + 1), 25)::numeric
  end
$$;

comment on function vacation_tracker.annual_days_for_years is
  '근속 N년차 시작일에 일괄 부여될 연차 일수 (15 + 가산, 25 상한).';

-- ------------------------------------------------------------
-- 중복 부여 방지 unique index (auto source 한정)
-- ------------------------------------------------------------
create unique index if not exists ux_grants_auto_unique
  on vacation_tracker.leave_grants (employee_id, grant_date, leave_type)
  where source = 'auto';

-- ------------------------------------------------------------
-- 메인 RPC: 호출자 회사의 모든 직원에 대해
--   hire_date 부터 p_as_of 까지의 미부여 자동 연차를 일괄 채움.
-- 반환: 직원별 새로 부여된 건수/일수.
-- 권한: admin 또는 manager.
-- ------------------------------------------------------------
create or replace function vacation_tracker.process_auto_grants(
  p_as_of date default current_date
)
returns table (
  employee_id        uuid,
  emp_no             text,
  name               text,
  granted_count      int,
  granted_total_days numeric
)
language plpgsql
security definer
set search_path = vacation_tracker, auth
as $$
declare
  v_caller_company uuid;
  v_caller_role    vacation_tracker.user_role;
  rec_emp          record;
  v_hire           date;
  v_anniv          date;
  v_days           numeric;
  v_count          int;
  v_total          numeric;
  i                int;
  v_year_n         int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select company_id, role
    into v_caller_company, v_caller_role
    from vacation_tracker.profiles where id = auth.uid();

  if v_caller_role not in ('admin', 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;

  for rec_emp in
    select id, emp_no, name, hire_date
      from vacation_tracker.profiles
     where company_id = v_caller_company
     order by hire_date
  loop
    v_hire  := rec_emp.hire_date;
    v_count := 0;
    v_total := 0;

    -- Phase 1: 입사 1년 미만 매월 1일 부여 (1~11개월차)
    i := 1;
    while i <= 11 loop
      v_anniv := (v_hire + (i || ' months')::interval)::date;
      exit when v_anniv > p_as_of;

      -- 1주년에 도달했으면 phase 2로 (= 만 12개월은 일괄 부여 대상)
      exit when v_anniv >= (v_hire + interval '1 year')::date;

      begin
        insert into vacation_tracker.leave_grants
          (company_id, employee_id, grant_date, leave_type, days, source, memo)
        values
          (v_caller_company, rec_emp.id, v_anniv, 'annual', 1.0, 'auto',
           format('입사 %s개월차 자동 부여', i));
        v_count := v_count + 1;
        v_total := v_total + 1.0;
      exception when unique_violation then
        -- already granted this slot, skip
      end;

      i := i + 1;
    end loop;

    -- Phase 2: 입사 1주년 이상 연 일괄 부여
    v_year_n := 1;
    while v_year_n <= 50 loop  -- 안전 상한
      v_anniv := (v_hire + (v_year_n || ' years')::interval)::date;
      exit when v_anniv > p_as_of;

      v_days := vacation_tracker.annual_days_for_years(v_year_n);

      begin
        insert into vacation_tracker.leave_grants
          (company_id, employee_id, grant_date, leave_type, days, source, memo)
        values
          (v_caller_company, rec_emp.id, v_anniv, 'annual', v_days, 'auto',
           format('근속 %s년차 일괄 부여 (%s일)', v_year_n, v_days));
        v_count := v_count + 1;
        v_total := v_total + v_days;
      exception when unique_violation then
        -- already granted, skip
      end;

      v_year_n := v_year_n + 1;
    end loop;

    if v_count > 0 then
      employee_id        := rec_emp.id;
      emp_no             := rec_emp.emp_no;
      name               := rec_emp.name;
      granted_count      := v_count;
      granted_total_days := v_total;
      return next;
    end if;
  end loop;

  return;
end;
$$;

grant execute on function vacation_tracker.process_auto_grants(date) to authenticated;

comment on function vacation_tracker.process_auto_grants is
  '회사 전체 직원에 대해 hire_date~p_as_of 구간의 자동 연차를 누락분만 일괄 부여.';

-- ------------------------------------------------------------
-- 수동 부여 RPC (대체휴무·특별휴가, 수동 연차 보정용)
-- ------------------------------------------------------------
create or replace function vacation_tracker.create_manual_grant(
  p_employee_id uuid,
  p_grant_date  date,
  p_leave_type  vacation_tracker.leave_type,
  p_days        numeric,
  p_memo        text default null
)
returns uuid
language plpgsql
security definer
set search_path = vacation_tracker, auth
as $$
declare
  v_caller_company uuid;
  v_caller_role    vacation_tracker.user_role;
  v_target_company uuid;
  v_grant_id       uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select company_id, role into v_caller_company, v_caller_role
    from vacation_tracker.profiles where id = auth.uid();
  if v_caller_role not in ('admin', 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;

  select company_id into v_target_company from vacation_tracker.profiles where id = p_employee_id;
  if v_target_company is null then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_target_company <> v_caller_company then
    raise exception 'CROSS_TENANT_FORBIDDEN';
  end if;

  if p_days <= 0 then raise exception 'INVALID_DAYS'; end if;

  insert into vacation_tracker.leave_grants
    (company_id, employee_id, grant_date, leave_type, days, source, memo)
  values
    (v_caller_company, p_employee_id, p_grant_date, p_leave_type, p_days, 'manual', p_memo)
  returning id into v_grant_id;

  return v_grant_id;
end;
$$;

grant execute on function vacation_tracker.create_manual_grant(uuid, date, vacation_tracker.leave_type, numeric, text) to authenticated;

comment on function vacation_tracker.create_manual_grant is
  '관리자가 직원에게 수동으로 휴가 부여 (대체휴무, 특별휴가, 수동 연차 등).';
