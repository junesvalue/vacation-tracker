# Vacation Tracker

한국형 기업 연차휴가 관리 SaaS — MVP 완료.

> Spec: [`../.omc/specs/deep-interview-vacation-tracker.md`](../.omc/specs/deep-interview-vacation-tracker.md)

## 한 줄 요약

다중 테넌트 SaaS로, 한국 근로기준법 실무 근사치 수준의 연차 자동 부여 + 근로자 직접 신청·관리자 승인 흐름을 제공한다. MVP는 "1개 회사가 철저히 쓸 수 있는 수준"을 목표로 한다.

## 기술 스택

| 영역 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | Next.js 16 (App Router) + React 19 + TypeScript | Turbopack 기본, `proxy.ts` 컨벤션 |
| 스타일링 | Tailwind CSS v4 + shadcn/ui | base preset, slate 계열 |
| 백엔드 / DB / 인증 / 호스팅 | Supabase (Postgres + Auth + RLS) | Seoul 리전, Free tier |
| 폼 처리 | React Server Actions (`useActionState`) | JS 없이도 동작 |
| E2E 테스트 | Playwright (Chromium) | 스모크 1개 + 5명 시나리오 체크리스트 |

## 구현된 기능 (MVP 전체)

### 인증·온보딩 (3단계)
- 이메일/비밀번호 회원가입·로그인·로그아웃
- 첫 가입 시 회사 등록 온보딩 → admin 권한 부여
- 미들웨어(`proxy.ts`) 세션 상태별 자동 라우팅
- 다중 테넌트 격리 (RLS 기반, 실제 두 계정으로 검증 완료)

### 직원 관리 (4단계, admin 전용)
- `/dashboard/employees`: 직원 목록
- `/dashboard/employees/new`: Admin API + RPC 조합으로 직원 계정 생성
- 임시 비밀번호 1회 표시
- 사번(emp_no)은 회사 내 unique
- 권한 가드: 비-admin은 페이지 접근 시 `/dashboard` 리다이렉트

### 휴가 부여 (5단계, admin/manager 전용)
- `/dashboard/grants`: 부여 이력 + 자동/수동 패널
- 자동 부여 엔진 (`process_auto_grants` RPC):
  - Phase 1 (입사 1년 미만): 매월 입사 응당일에 1일씩, 최대 11번
  - Phase 2 (입사 1주년 이상): 매년 (15 + 근속가산) 일괄 부여
  - 가산 공식: 1·2년차=15, 3·4=16, 5·6=17, …, 21+=25 (상한)
  - **재실행 안전** (idempotent) — partial unique index로 중복 방지
- 수동 부여 (대체휴무·특별휴가·연차 보정용)

### 휴가 신청·승인 (6단계)
- `/dashboard/requests`: 역할별 3섹션 (승인 대기 / 내 신청 / 최근 처리)
- `/dashboard/requests/new`: 신청 폼 (전일/오전반차/오후반차)
- 비즈니스 룰 (RPC 안에서 강제):
  - 같은 직원, 같은 사용일자에 비-반려 신청 있으면 거절
  - 신청 시점·승인 시점 모두 잔여 검증 (race 방지)
  - employee는 본인 pending 신청 취소 가능
  - admin/manager만 승인/반려

### 잔여 대시보드 (7단계)
- `/dashboard`: 본인 잔여 3종 카드 + 사용·부여 이력
- `/dashboard/balances` (admin/manager): 전사원 잔여 매트릭스 (직원 × 종류 × 부여/사용/잔여)
- 모든 계산은 view `leave_balances` 가 실시간 처리

## 디렉토리 구조

```
vacation-tracker/
├── src/
│   ├── app/
│   │   ├── (auth)/                    ← 로그인/가입 그룹
│   │   ├── dashboard/
│   │   │   ├── balances/page.tsx      ← 전사원 잔여
│   │   │   ├── employees/             ← 직원 CRUD
│   │   │   ├── grants/                ← 부여 관리
│   │   │   ├── requests/              ← 신청·승인
│   │   │   └── page.tsx               ← 본인 대시보드
│   │   ├── onboarding/
│   │   ├── layout.tsx, globals.css
│   │   └── page.tsx                   ← / → /dashboard 리다이렉트
│   ├── components/ui/                 ← shadcn (button, input, label, card)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── admin.ts               ← service_role 전용 (server-only)
│   │   │   ├── client.ts              ← Browser
│   │   │   ├── server.ts              ← Server Component/Action
│   │   │   └── middleware.ts          ← 세션 갱신 헬퍼
│   │   └── utils.ts
│   └── proxy.ts                       ← Next 16 라우팅 보호
├── supabase/migrations/               ← 0001 ~ 0008 SQL
├── tests/e2e/smoke-signup.spec.ts     ← Playwright 스모크
├── playwright.config.ts
├── .env.local                         ← gitignored
└── README.md
```

## 로컬 실행

### 1. 의존성 설치
```bash
npm install
npx playwright install chromium   # E2E 테스트 시
```

### 2. 환경변수 (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
값은 [Supabase 대시보드](https://supabase.com/dashboard) → Project Settings → API.
**`SUPABASE_SERVICE_ROLE_KEY` 는 절대 클라이언트 노출 금지.**

### 3. Supabase 마이그레이션 (최초 1회)
대시보드 → SQL Editor 에서 `supabase/migrations/` 의 SQL 파일을 **번호 순서대로** 실행:
1. `0001_initial_schema.sql`
2. `0002_rls_policies.sql`
3. `0003_view_security_invoker.sql`
4. `0004_rpc_onboarding.sql`
5. `0005_rpc_create_employee.sql`
6. `0006_auto_grant_engine.sql`
7. `0007_fix_auto_grant_ambiguity.sql`
8. `0008_leave_request_rpcs.sql`

### 4. Authentication 설정
대시보드 → Authentication → Sign In/Providers → Email → "Confirm email" **OFF** (개발용).

### 5. 개발 서버
```bash
npm run dev
```
http://localhost:3000

### 6. E2E 스모크 테스트
```bash
npm run test:e2e        # headless
npm run test:e2e:ui     # UI 모드 (디버깅용)
```

## MVP 검증 체크리스트 (가상 회사 + 직원 5명 풀 시나리오)

spec의 합의된 MVP 완료 기준. 새 Supabase 프로젝트에서 위 1~5 셋업 후 다음을 통과하면 MVP "철저히 쓸 수 있는 수준" 도달.

### Phase 1 — 회사·직원 셋업 (admin)
- [ ] 새 이메일로 회원가입 → 자동 `/onboarding` 이동
- [ ] 회사명·사번·이름·입사일 입력 → 대시보드 진입, "직원 관리" 버튼 표시
- [ ] `/dashboard/employees/new` 에서 직원 5명 등록 (역할 분포: 1 manager + 4 employee 권장)
- [ ] 각 등록 시 임시 비밀번호 표시 → 메모

### Phase 2 — 자동 부여
- [ ] `/dashboard/grants` → "자동 부여 실행" 클릭
- [ ] 처리 결과에 5명 모두 표시, 입사일 기준 일수 정확
- [ ] 같은 버튼 재클릭 → "추가 부여할 항목이 없습니다" (idempotent)
- [ ] 이력 테이블에 auto 부여 다수 표시

### Phase 3 — 직원 신청·승인
- [ ] employee 1명 로그인 (시크릿 창) → 휴가 신청 (전일 1건, 반차 1건)
- [ ] 본인 신청 취소 (cancel) 1건 검증
- [ ] admin 또는 manager 로그인 → 승인 대기에 employee 신청 표시
- [ ] 승인 처리 → 해당 employee의 잔여가 줄어든 것 확인 (전사원 잔여)

### Phase 4 — 다중 테넌트 격리 (RLS)
- [ ] 시크릿 창에서 새 이메일로 가입 → 다른 회사명으로 온보딩
- [ ] 두 회사 데이터가 서로 보이지 않음 확인 (각 대시보드에서 자기 회사만)

### Phase 5 — 자동 회귀
- [ ] `npm run test:e2e` → 스모크 1건 PASS

## 주요 설계 결정 (ADR)

| 결정 | 이유 |
|------|------|
| 다중 테넌트 SaaS (vs. 자사 사내 도구) | Deep Interview Round 1 — 여러 기업 가입 모델로 확정 |
| MVP는 "1개 회사 철저히 사용" 수준 | Round 2 — 옵션 완전판 대신 핵심만 |
| 입사일 기준 (회계년도 보류) | Round 2 — MVP 범위 |
| 미사용 연차 차년도 이월 (소각/촉진제 보류) | Round 2 |
| 일·반차까지만 (반반차/시간제 보류) | Round 2 + Round 6 |
| 휴가 종류 3종: annual/comp/special | Round 6 Simplifier |
| 한국 근로기준법 실무 근사치 | Round 3 |
| 근로자 직접 신청 + 부서장 승인 (관리자 대신 입력 X) | Round 4 Contrarian |
| Next.js + Supabase 단일 통합 스택 | Round 5 |
| MVP 완료 = 가상 회사 + 직원 5명 풀 시나리오 | Round 6 |
| RLS로 테넌트 격리 (애플리케이션 레벨 격리 X) | Postgres 네이티브 |
| `leave_balances` view (테이블 X) | 책임 모호성 회피 |
| 모든 테이블 `company_id` 중복 보관 | RLS 정책 단순화 + 성능 |
| 직원 등록 = Admin API + 임시 비번 (이메일 초대 X) | MVP 단순화 (이메일 인프라 의존 X) |
| RPC + SECURITY DEFINER 전반 사용 | 트랜잭션 보장 + RLS 우회 통제 |
| Server Actions 사용 (Client `onSubmit` 대신) | JS 없이 동작 + 쿠키 직접 설정 |
| `middleware.ts` → `proxy.ts` | Next 16 deprecation 대응 |

## MVP 이후 (2단계로 명시 연기)

- 회계년도 기준 옵션
- 연차촉진제 / 미사용 소각
- 반반차 / 시간제 휴가 단위
- 근로자 네이티브 앱 (React Native)
- 광고 수익화
- 결제 / 구독 시스템
- 80% 출근율 자동 계산
- 다국어 / 다통화
- 직원 정보 수정·비활성화 화면
- 이메일 초대 흐름 (`inviteUserByEmail`)
- pg_cron 또는 Vercel Cron 으로 자동 부여 일배치
- E2E: 5명 풀 시나리오 자동화

## 라이선스

Private (비공개) — 추후 결정.
