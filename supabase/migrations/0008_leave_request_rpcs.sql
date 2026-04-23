-- ============================================================
-- 0008_leave_request_rpcs.sql
-- 휴가 신청/승인 RPC 세트 — 잔여 검증 + 동일일자 중복 방지 + 권한 가드
-- ============================================================

-- ------------------------------------------------------------
-- 헬퍼: duration → 일수
-- ------------------------------------------------------------
create or replace function public.duration_days(p_duration leave_duration)
returns numeric
language sql
immutable
as $$
  select case p_duration
    when 'full'    then 1.0::numeric
    when 'half_am' then 0.5::numeric
    when 'half_pm' then 0.5::numeric
  end
$$;

-- ------------------------------------------------------------
-- 헬퍼: 특정 직원·종류의 현재 잔여 (view를 그대로 활용)
-- ------------------------------------------------------------
create or replace function public.remaining_days(p_employee_id uuid, p_leave_type leave_type)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(remaining_days, 0)
    from leave_balances
   where employee_id = p_employee_id
     and leave_type = p_leave_type
$$;

-- ------------------------------------------------------------
-- 신청 RPC
--   호출자 본인의 신청만 생성 가능 (admin이 대신 등록은 허용 안 함)
--   잔여 < 신청일수 → INSUFFICIENT_BALANCE
--   동일 use_date에 비-반려 신청 존재 → DUPLICATE_DATE
-- ------------------------------------------------------------
create or replace function public.submit_leave_request(
  p_use_date   date,
  p_duration   leave_duration,
  p_leave_type leave_type,
  p_reason     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_company uuid;
  v_caller_id      uuid := auth.uid();
  v_request_days   numeric;
  v_remaining      numeric;
  v_request_id     uuid;
begin
  if v_caller_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select company_id into v_caller_company from profiles where id = v_caller_id;
  if v_caller_company is null then raise exception 'PROFILE_REQUIRED'; end if;

  if p_use_date is null then raise exception 'INVALID_DATE'; end if;

  v_request_days := duration_days(p_duration);
  if v_request_days is null then raise exception 'INVALID_DURATION'; end if;

  if exists (
    select 1 from leave_requests
     where employee_id = v_caller_id
       and use_date = p_use_date
       and status <> 'rejected'
  ) then
    raise exception 'DUPLICATE_DATE';
  end if;

  v_remaining := remaining_days(v_caller_id, p_leave_type);
  if v_remaining < v_request_days then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into leave_requests
    (company_id, employee_id, use_date, duration, leave_type, status, reason)
  values
    (v_caller_company, v_caller_id, p_use_date, p_duration, p_leave_type, 'pending', p_reason)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.submit_leave_request(date, leave_duration, leave_type, text) to authenticated;

-- ------------------------------------------------------------
-- 결정 RPC (승인/반려)
--   - admin/manager: 같은 회사의 pending 신청을 approve/reject 가능
--   - employee: 본인의 pending 신청을 reject(=취소)만 가능
--   - approve 시점에 잔여 재검증 (race 대비)
-- ------------------------------------------------------------
create or replace function public.decide_leave_request(
  p_request_id     uuid,
  p_decision       request_status,
  p_decided_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_company uuid;
  v_caller_role    user_role;
  v_caller_id      uuid := auth.uid();
  v_req            record;
  v_request_days   numeric;
  v_remaining      numeric;
begin
  if v_caller_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select company_id, role into v_caller_company, v_caller_role
    from profiles where id = v_caller_id;

  select * into v_req from leave_requests where id = p_request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.company_id <> v_caller_company then
    raise exception 'CROSS_TENANT_FORBIDDEN';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  -- 권한 체크
  -- 본인 신청 취소(reject)는 모두 허용
  -- approve/타인 신청 결정은 admin/manager만
  if v_req.employee_id <> v_caller_id then
    if v_caller_role not in ('admin', 'manager') then
      raise exception 'NOT_ALLOWED';
    end if;
  else
    -- 본인 신청에 대한 결정
    if p_decision = 'approved' and v_caller_role not in ('admin', 'manager') then
      raise exception 'NOT_ALLOWED';
    end if;
  end if;

  if p_decision = 'approved' then
    v_request_days := duration_days(v_req.duration);
    v_remaining := remaining_days(v_req.employee_id, v_req.leave_type);
    if v_remaining < v_request_days then
      raise exception 'INSUFFICIENT_BALANCE';
    end if;
  end if;

  update leave_requests
     set status         = p_decision,
         approver_id    = v_caller_id,
         decided_reason = p_decided_reason,
         decided_at     = now()
   where id = p_request_id;
end;
$$;

grant execute on function public.decide_leave_request(uuid, request_status, text) to authenticated;
