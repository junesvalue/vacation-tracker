-- ============================================================
-- 0000_create_schema.sql
-- vacation_tracker 전용 스키마 — 학습용 단일 Supabase 프로젝트에
-- 여러 앱을 얹기 위한 네임스페이스 격리.
--
-- 패턴:
--   - auth.users는 모든 앱이 공유 (단일 SSO)
--   - 앱별 데이터는 각자의 스키마(vacation_tracker, future_app2, ...)에 격리
--   - 새 앱 추가 시: 새 스키마 생성 + Dashboard "Exposed schemas"에 등록
-- ============================================================

create schema if not exists vacation_tracker;

-- PostgREST/Supabase 클라이언트가 이 스키마를 사용할 수 있도록 USAGE 부여.
-- 행 단위 접근 통제는 RLS가 담당하므로 grant 자체는 넓게 줘도 안전.
grant usage on schema vacation_tracker to anon, authenticated, service_role;

grant all on all tables    in schema vacation_tracker to anon, authenticated, service_role;
grant all on all routines  in schema vacation_tracker to anon, authenticated, service_role;
grant all on all sequences in schema vacation_tracker to anon, authenticated, service_role;

-- 이후 마이그레이션에서 새로 만드는 객체에도 동일 권한이 자동 부여되도록.
alter default privileges in schema vacation_tracker
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema vacation_tracker
  grant all on routines  to anon, authenticated, service_role;
alter default privileges in schema vacation_tracker
  grant all on sequences to anon, authenticated, service_role;

comment on schema vacation_tracker is
  '연차휴가 관리 앱 전용 스키마 — 학습용 멀티앱 Supabase 프로젝트의 격리 네임스페이스.';
