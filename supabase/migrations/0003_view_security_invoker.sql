-- ============================================================
-- 0003_view_security_invoker.sql
-- leave_balances view가 호출자(=현재 로그인 유저)의 권한으로 실행되도록 변경.
-- 이렇게 하면 leave_grants/leave_requests에 걸린 RLS가 자동 적용되어
-- view를 통해서도 다른 회사 데이터가 새지 않음.
-- 요구사항: Postgres 15+ (Supabase는 15 이상 사용)
-- ============================================================

alter view vacation_tracker.leave_balances set (security_invoker = true);
