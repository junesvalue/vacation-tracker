# Vacation Tracker

한국형 기업 연차휴가 관리 SaaS — MVP 개발 진행 중.

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
| 배포 | (예정) Vercel | |
| 테스트 | (예정) Vitest + Playwright | 8단계에 도입 |

## 현재까지 구현된 것 (0~3단계)

### 인증·온보딩
- 이메일/비밀번호 회원가입 (이메일 확인 OFF, 개발 모드)
- 로그인 / 로그아웃
- 첫 가입 시 회사 등록 온보딩 → 자동으로 admin 권한 부여
- 미들웨어(`proxy.ts`)가 세션 상태별 자동 라우팅:
  - 비로그인 → `/login`
  - 로그인 + 프로필 없음 → `/onboarding`
  - 로그인 + 프로필 있음 → `/dashboard`
  - 로그인 상태에서 `/login` `/signup` 접근 → `/dashboard`

### 데이터베이스
- 4개 테이블: `companies`, `profiles`, `leave_grants`, `leave_requests`
- 1개 view: `leave_balances` (잔여 = 부여 합 − 승인된 신청 환산일수)
- 모든 테이블 RLS 활성화 + 13개 정책으로 테넌트 격리
- 헬퍼 함수: `current_company_id()`, `current_user_role()` (SECURITY DEFINER)
- 온보딩 RPC: `create_company_with_admin(...)` (회사 + admin 프로필 atomic 생성)

### 화면
- `/login` — 로그인
- `/signup` — 회원가입
- `/onboarding` — 회사·본인 정보 등록 (가입 후 1회)
- `/dashboard` — 본인 프로필·소속 회사 표시 + 로그아웃

## 디렉토리 구조

```
vacation-tracker/
├── src/
│   ├── app/
│   │   ├── (auth)/            ← 로그인/가입 그룹 (URL에는 안 나타남)
│   │   │   ├── actions.ts     ← login/signup/logout Server Actions
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── onboarding/
│   │   │   ├── actions.ts     ← createCompany Server Action (RPC 호출)
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           ← / → /dashboard 리다이렉트
│   ├── components/ui/         ← shadcn 컴포넌트 (button, input, label, card)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      ← Browser Component용
│   │   │   ├── server.ts      ← Server Component/Action용
│   │   │   └── middleware.ts  ← 세션 갱신 헬퍼
│   │   └── utils.ts           ← cn() 헬퍼
│   └── proxy.ts               ← Next 16 Proxy (라우팅 보호)
├── supabase/
│   └── migrations/
│       ├── 0001_initial_schema.sql
│       ├── 0002_rls_policies.sql
│       ├── 0003_view_security_invoker.sql
│       └── 0004_rpc_onboarding.sql
├── .env.local                 ← Supabase URL/key (gitignore됨)
├── components.json            ← shadcn/ui 설정
└── README.md
```

## 로컬 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
프로젝트 루트에 `.env.local` 파일 생성:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

값은 [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 → Project Settings → API 에서 복사.

### 3. Supabase에 마이그레이션 적용 (최초 1회)
대시보드 → SQL Editor 에서 `supabase/migrations/` 의 SQL 파일을 **번호 순서대로** 실행:
1. `0001_initial_schema.sql`
2. `0002_rls_policies.sql`
3. `0003_view_security_invoker.sql`
4. `0004_rpc_onboarding.sql`

### 4. Authentication 설정
대시보드 → Authentication → Sign In / Providers → Email → "Confirm email" 토글 OFF (개발용)

### 5. 개발 서버 실행
```bash
npm run dev
```
http://localhost:3000 접속.

## 주요 설계 결정 (Architecture Decisions)

| 결정 | 이유 |
|------|------|
| 다중 테넌트 SaaS (vs. 자사 사내 도구) | Deep Interview Round 1 — 여러 기업 가입 모델로 확정 |
| MVP는 "1개 회사 철저히 사용" 수준 | Round 2 — 옵션 완전판 대신 핵심만 |
| 입사일 기준 (회계년도 보류) | Round 2 — MVP 범위 |
| 미사용 연차 차년도 이월 (소각/촉진제 보류) | Round 2 |
| 일·반차까지만 (반반차/시간제 보류) | Round 2 + Round 6 (스키마에서 시간 필드 제거) |
| 휴가 종류 3종: annual/comp/special | Round 6 Simplifier — 5종 → 3종 단순화 |
| 한국 근로기준법 실무 근사치 | Round 3 — 80% 출근율은 수동 우회 |
| 근로자 직접 신청 + 부서장 승인 (관리자 대신 입력 X) | Round 4 Contrarian — 핵심 가치로 확정 |
| Next.js + Supabase 단일 통합 스택 | Round 5 — 인증·DB·호스팅 분리 비용 회피 |
| MVP 완료 기준: 가상 회사 1개 + 직원 5명 풀 시나리오 통과 | Round 6 |
| RLS로 테넌트 격리 (애플리케이션 레벨 격리 X) | Postgres 네이티브, DB 자체가 보안 경계 |
| `leave_balances` 는 view (테이블 X) | "누가 업데이트하나" 책임 모호성 회피, 항상 신선한 값 |
| 모든 테이블에 `company_id` 중복 보관 | RLS 정책 단순화 + 성능 (정규화 이론 위배 감수) |
| `create_company_with_admin` RPC | 회사+프로필 동시 생성을 트랜잭션으로 보장 |
| 2단계 가입 (Auth → Onboarding) | Vercel/Linear 등 SaaS 표준 패턴 |
| Server Actions 사용 (Client `onSubmit` 대신) | JS 없이 동작 + 쿠키 직접 설정 가능 |
| `middleware.ts` → `proxy.ts` 마이그레이션 | Next 16 deprecation 대응 |

## 아직 구현 안 된 것 (4~8단계)

- 4단계: 관리자가 직원 등록·수정·삭제 / 직원 초대(이메일) 흐름
- 5단계: 연차 자동 부여 엔진 (입사 1년 미만 매월 1, 1년+ 15일+근속가산 25일 한도)
- 6단계: 휴가 신청·승인 화면 + 잔여 차감 로직
- 7단계: 잔여·사용이력 대시보드 (관리자 전사원 / 근로자 본인)
- 8단계: 모바일 반응형 폴리싱 + Playwright E2E (가상 회사 5명 풀 시나리오)

## MVP 이후 (2단계로 명시 연기)

- 회계년도 기준 옵션
- 연차촉진제 / 미사용 소각
- 반반차 / 시간제 휴가 단위
- 근로자 네이티브 앱 (React Native)
- 광고 수익화
- 결제 / 구독 시스템
- 80% 출근율 자동 계산
- 다국어 / 다통화

## 라이선스

Private (비공개) — 추후 결정.
