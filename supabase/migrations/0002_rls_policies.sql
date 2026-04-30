-- ============================================================
-- 0002_rls_policies.sql
-- Row Level Security 정책 — 테넌트 격리
-- 핵심 원칙: 로그인한 유저의 company_id와 일치하는 행만 접근
-- ============================================================

-- ------------------------------------------------------------
-- helper function: 현재 로그인 유저의 company_id 조회
--   profiles에서 auth.uid()로 매칭. SECURITY DEFINER로 RLS 무한루프 회피.
-- ------------------------------------------------------------
create or replace function vacation_tracker.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = vacation_tracker, auth
as $$
  select company_id from vacation_tracker.profiles where id = auth.uid()
$$;

create or replace function vacation_tracker.current_user_role()
returns vacation_tracker.user_role
language sql
stable
security definer
set search_path = vacation_tracker, auth
as $$
  select role from vacation_tracker.profiles where id = auth.uid()
$$;

-- ------------------------------------------------------------
-- companies: 본인 회사만 조회. 신규 회사 생성은 회원가입 경로에서 별도 처리.
-- ------------------------------------------------------------
alter table vacation_tracker.companies enable row level security;

create policy "own_company_select"
  on vacation_tracker.companies for select
  using (id = vacation_tracker.current_company_id());

create policy "admin_company_update"
  on vacation_tracker.companies for update
  using (id = vacation_tracker.current_company_id() and vacation_tracker.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- profiles: 같은 회사 사람만 보기. 본인 프로필 수정 가능. admin은 전사원 수정.
-- ------------------------------------------------------------
alter table vacation_tracker.profiles enable row level security;

create policy "same_company_profiles_select"
  on vacation_tracker.profiles for select
  using (company_id = vacation_tracker.current_company_id());

create policy "self_profile_update"
  on vacation_tracker.profiles for update
  using (id = auth.uid());

create policy "admin_profile_all"
  on vacation_tracker.profiles for all
  using (company_id = vacation_tracker.current_company_id() and vacation_tracker.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- leave_grants: 같은 회사 모두 조회. 부여는 admin/manager만.
-- ------------------------------------------------------------
alter table vacation_tracker.leave_grants enable row level security;

create policy "same_company_grants_select"
  on vacation_tracker.leave_grants for select
  using (company_id = vacation_tracker.current_company_id());

create policy "manager_grants_insert"
  on vacation_tracker.leave_grants for insert
  with check (
    company_id = vacation_tracker.current_company_id()
    and vacation_tracker.current_user_role() in ('admin', 'manager')
  );

create policy "manager_grants_update"
  on vacation_tracker.leave_grants for update
  using (
    company_id = vacation_tracker.current_company_id()
    and vacation_tracker.current_user_role() in ('admin', 'manager')
  );

create policy "admin_grants_delete"
  on vacation_tracker.leave_grants for delete
  using (
    company_id = vacation_tracker.current_company_id()
    and vacation_tracker.current_user_role() = 'admin'
  );

-- ------------------------------------------------------------
-- leave_requests: 본인 신청 조회·생성. 관리자/매니저는 전사원 조회·승인.
-- ------------------------------------------------------------
alter table vacation_tracker.leave_requests enable row level security;

create policy "own_or_manager_requests_select"
  on vacation_tracker.leave_requests for select
  using (
    company_id = vacation_tracker.current_company_id()
    and (
      employee_id = auth.uid()
      or vacation_tracker.current_user_role() in ('admin', 'manager')
    )
  );

create policy "self_request_insert"
  on vacation_tracker.leave_requests for insert
  with check (
    company_id = vacation_tracker.current_company_id()
    and employee_id = auth.uid()
    and status = 'pending'
  );

create policy "self_pending_request_update"
  on vacation_tracker.leave_requests for update
  using (
    employee_id = auth.uid()
    and status = 'pending'
  );

create policy "manager_request_decide"
  on vacation_tracker.leave_requests for update
  using (
    company_id = vacation_tracker.current_company_id()
    and vacation_tracker.current_user_role() in ('admin', 'manager')
  );
