-- ============================================================
-- 0005_rpc_create_employee.sql
-- 관리자가 직원 프로필을 생성하는 RPC.
-- 호출 전제: Admin API로 auth.users 행을 먼저 만들어 user_id를 확보한 상태.
-- 보안: SECURITY DEFINER + 호출자 admin 검증.
-- ============================================================

create or replace function vacation_tracker.create_employee(
  p_user_id    uuid,
  p_emp_no     text,
  p_name       text,
  p_hire_date  date,
  p_birth_date date default null,
  p_role       vacation_tracker.user_role default 'employee'
)
returns uuid
language plpgsql
security definer
set search_path = vacation_tracker, auth
as $$
declare
  v_caller_company  uuid;
  v_caller_role     vacation_tracker.user_role;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select company_id, role
    into v_caller_company, v_caller_role
    from vacation_tracker.profiles
   where id = auth.uid();

  if v_caller_company is null then
    raise exception 'CALLER_NO_PROFILE';
  end if;

  if v_caller_role <> 'admin' then
    raise exception 'NOT_ADMIN';
  end if;

  if coalesce(trim(p_emp_no), '') = '' then
    raise exception 'INVALID_EMP_NO';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'INVALID_NAME';
  end if;
  if p_hire_date is null then
    raise exception 'INVALID_HIRE_DATE';
  end if;

  if exists (
    select 1 from vacation_tracker.profiles
     where company_id = v_caller_company
       and emp_no = trim(p_emp_no)
  ) then
    raise exception 'DUPLICATE_EMP_NO';
  end if;

  insert into vacation_tracker.profiles (id, company_id, emp_no, name, hire_date, birth_date, role)
  values (p_user_id, v_caller_company, trim(p_emp_no), trim(p_name),
          p_hire_date, p_birth_date, p_role);

  return p_user_id;
end;
$$;

grant execute on function vacation_tracker.create_employee(uuid, text, text, date, date, vacation_tracker.user_role) to authenticated;

comment on function vacation_tracker.create_employee is
  '관리자가 신규 직원 프로필을 생성. auth.users는 사전에 Admin API로 생성되어 있어야 함.';
