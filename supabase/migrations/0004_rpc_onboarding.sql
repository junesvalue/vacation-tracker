-- ============================================================
-- 0004_rpc_onboarding.sql
-- 관리자 온보딩용 RPC: 회사 + 본인 프로필(role='admin')을 원자적으로 생성.
-- 호출 조건:
--   - 로그인 상태여야 함 (auth.uid() not null)
--   - 아직 profile이 없어야 함 (중복 온보딩 방지)
-- ============================================================

create or replace function vacation_tracker.create_company_with_admin(
  p_company_name text,
  p_emp_no       text,
  p_name         text,
  p_hire_date    date,
  p_birth_date   date default null
)
returns uuid
language plpgsql
security definer
set search_path = vacation_tracker, auth
as $$
declare
  v_uid         uuid := auth.uid();
  v_company_id  uuid;
  v_existing    uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select id into v_existing from vacation_tracker.profiles where id = v_uid;
  if found then
    raise exception 'PROFILE_ALREADY_EXISTS';
  end if;

  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'INVALID_COMPANY_NAME';
  end if;
  if coalesce(trim(p_emp_no), '') = '' then
    raise exception 'INVALID_EMP_NO';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'INVALID_NAME';
  end if;

  insert into vacation_tracker.companies (name)
  values (trim(p_company_name))
  returning id into v_company_id;

  insert into vacation_tracker.profiles (id, company_id, emp_no, name, hire_date, birth_date, role)
  values (v_uid, v_company_id, trim(p_emp_no), trim(p_name), p_hire_date, p_birth_date, 'admin');

  return v_company_id;
end;
$$;

grant execute on function vacation_tracker.create_company_with_admin(text, text, text, date, date) to authenticated;

comment on function vacation_tracker.create_company_with_admin is
  '관리자 온보딩: 회사 + admin 프로필을 atomically 생성. 로그인 필요, profile 미존재 필요.';
