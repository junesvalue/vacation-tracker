-- ============================================================
-- 0007_fix_auto_grant_ambiguity.sql
-- 0006의 process_auto_grants에서 OUT 파라미터(emp_no, name)와
-- profiles 컬럼명이 충돌해 'column reference is ambiguous' 발생.
-- FOR 루프 SELECT를 별칭(p.)으로 수식하여 해결.
-- ============================================================

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
    select p.id        as p_id,
           p.emp_no    as p_emp_no,
           p.name      as p_name,
           p.hire_date as p_hire_date
      from vacation_tracker.profiles p
     where p.company_id = v_caller_company
     order by p.hire_date
  loop
    v_hire  := rec_emp.p_hire_date;
    v_count := 0;
    v_total := 0;

    -- Phase 1: 입사 1년 미만 매월 1일 부여 (1~11개월차)
    i := 1;
    while i <= 11 loop
      v_anniv := (v_hire + (i || ' months')::interval)::date;
      exit when v_anniv > p_as_of;
      exit when v_anniv >= (v_hire + interval '1 year')::date;

      begin
        insert into vacation_tracker.leave_grants
          (company_id, employee_id, grant_date, leave_type, days, source, memo)
        values
          (v_caller_company, rec_emp.p_id, v_anniv, 'annual', 1.0, 'auto',
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
    while v_year_n <= 50 loop
      v_anniv := (v_hire + (v_year_n || ' years')::interval)::date;
      exit when v_anniv > p_as_of;

      v_days := vacation_tracker.annual_days_for_years(v_year_n);

      begin
        insert into vacation_tracker.leave_grants
          (company_id, employee_id, grant_date, leave_type, days, source, memo)
        values
          (v_caller_company, rec_emp.p_id, v_anniv, 'annual', v_days, 'auto',
           format('근속 %s년차 일괄 부여 (%s일)', v_year_n, v_days));
        v_count := v_count + 1;
        v_total := v_total + v_days;
      exception when unique_violation then
        -- already granted, skip
      end;

      v_year_n := v_year_n + 1;
    end loop;

    if v_count > 0 then
      employee_id        := rec_emp.p_id;
      emp_no             := rec_emp.p_emp_no;
      name               := rec_emp.p_name;
      granted_count      := v_count;
      granted_total_days := v_total;
      return next;
    end if;
  end loop;

  return;
end;
$$;
