-- ============================================================
-- 0001_initial_schema.sql
-- 기업 연차휴가 관리 SaaS 초기 스키마 (MVP)
-- 생성일: 2026-04-22 / 멀티앱 격리 적용일: 2026-04-30
-- 모든 객체는 vacation_tracker 스키마에 격리됨. auth.users만 시스템 공유.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUM 타입 정의
-- ------------------------------------------------------------
create type vacation_tracker.user_role      as enum ('admin', 'manager', 'employee');
create type vacation_tracker.leave_type     as enum ('annual', 'comp', 'special');
create type vacation_tracker.grant_source   as enum ('auto', 'manual');
create type vacation_tracker.leave_duration as enum ('full', 'half_am', 'half_pm');
create type vacation_tracker.request_status as enum ('pending', 'approved', 'rejected');

-- ------------------------------------------------------------
-- 2. companies (회사/테넌트)
-- ------------------------------------------------------------
create table vacation_tracker.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table vacation_tracker.companies is '테넌트(회사) — SaaS 가입 단위. 모든 다른 테이블은 이 company_id로 격리됨.';

-- ------------------------------------------------------------
-- 3. profiles (auth.users 1:1 확장)
--    auth.users: Supabase Auth가 자동 관리 (이메일/비번/토큰)
--    profiles:   도메인 필드 (사번/입사일/소속회사/역할)
-- ------------------------------------------------------------
create table vacation_tracker.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  company_id   uuid not null references vacation_tracker.companies(id) on delete cascade,
  emp_no       text not null,
  name         text not null,
  hire_date    date not null,
  birth_date   date,
  role         vacation_tracker.user_role not null default 'employee',
  created_at   timestamptz not null default now(),
  unique (company_id, emp_no)  -- 같은 회사 내 사번 중복 금지
);

create index idx_profiles_company on vacation_tracker.profiles(company_id);

comment on table vacation_tracker.profiles is '직원 프로필. auth.users.id와 1:1로 매핑됨.';

-- ------------------------------------------------------------
-- 4. leave_grants (휴가 부여 이력)
-- ------------------------------------------------------------
create table vacation_tracker.leave_grants (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references vacation_tracker.companies(id) on delete cascade,
  employee_id  uuid not null references vacation_tracker.profiles(id) on delete cascade,
  grant_date   date not null,
  leave_type   vacation_tracker.leave_type not null,
  days         numeric(5,2) not null check (days > 0),
  memo         text,
  source       vacation_tracker.grant_source not null default 'manual',
  created_at   timestamptz not null default now()
);

create index idx_grants_company_employee on vacation_tracker.leave_grants(company_id, employee_id);
create index idx_grants_grant_date on vacation_tracker.leave_grants(grant_date);

comment on table vacation_tracker.leave_grants is '휴가 부여 기록 — 월별 자동 부여, 연간 일괄 부여, 대체휴무 수동 부여 등이 모두 이 테이블에 기록됨.';

-- ------------------------------------------------------------
-- 5. leave_requests (휴가 신청/승인)
-- ------------------------------------------------------------
create table vacation_tracker.leave_requests (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references vacation_tracker.companies(id) on delete cascade,
  employee_id        uuid not null references vacation_tracker.profiles(id) on delete cascade,
  use_date           date not null,
  duration           vacation_tracker.leave_duration not null,
  leave_type         vacation_tracker.leave_type not null,
  status             vacation_tracker.request_status not null default 'pending',
  approver_id        uuid references vacation_tracker.profiles(id),
  reason             text,
  decided_reason     text,
  submitted_at       timestamptz not null default now(),
  decided_at         timestamptz
);

create index idx_requests_company_employee on vacation_tracker.leave_requests(company_id, employee_id);
create index idx_requests_status on vacation_tracker.leave_requests(status);
create index idx_requests_use_date on vacation_tracker.leave_requests(use_date);

comment on table vacation_tracker.leave_requests is '휴가 신청 건. status=approved인 건만 잔여 차감에 반영됨.';

-- ------------------------------------------------------------
-- 6. View: leave_balances (잔여연차 계산)
--    grants 합 − approved requests 환산일수 합
--    full=1.0일, half_am/half_pm=0.5일
-- ------------------------------------------------------------
create view vacation_tracker.leave_balances as
with granted as (
  select
    company_id,
    employee_id,
    leave_type,
    coalesce(sum(days), 0) as granted_days
  from vacation_tracker.leave_grants
  group by company_id, employee_id, leave_type
),
used as (
  select
    company_id,
    employee_id,
    leave_type,
    coalesce(sum(case duration
      when 'full'    then 1.0
      when 'half_am' then 0.5
      when 'half_pm' then 0.5
    end), 0) as used_days
  from vacation_tracker.leave_requests
  where status = 'approved'
  group by company_id, employee_id, leave_type
)
select
  coalesce(g.company_id, u.company_id)   as company_id,
  coalesce(g.employee_id, u.employee_id) as employee_id,
  coalesce(g.leave_type, u.leave_type)   as leave_type,
  coalesce(g.granted_days, 0)            as granted_days,
  coalesce(u.used_days, 0)               as used_days,
  coalesce(g.granted_days, 0) - coalesce(u.used_days, 0) as remaining_days
from granted g
full outer join used u
  on g.company_id = u.company_id
 and g.employee_id = u.employee_id
 and g.leave_type = u.leave_type;

comment on view vacation_tracker.leave_balances is '실시간 잔여 계산. 테이블이 아닌 view여서 업데이트 책임 불필요.';
