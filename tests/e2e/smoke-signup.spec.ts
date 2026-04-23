import { test, expect } from '@playwright/test';

/**
 * Smoke test: 신규 가입 → 온보딩 → 대시보드 진입까지 풀 사이클.
 *
 * 주의: 실제 Supabase에 연결되어 매 실행마다 새 auth.users + companies + profiles
 * 행이 만들어집니다. CI/프로덕션에서는 별도 테스트 프로젝트 분리를 권장.
 *
 * 정리: 테스트 후 Supabase Dashboard → Authentication → Users 에서 e2e-* 사용자
 * 제거 가능. companies/profiles는 cascade 삭제됨.
 */
test('signup → onboarding → dashboard', async ({ page }) => {
  const ts = Date.now();
  const email = `e2e-${ts}@example.com`;
  const password = 'TestPass123!';
  const companyName = `E2ETestCo-${ts}`;
  const empNo = `E${ts}`;
  const fullName = `E2E 테스터`;

  await page.goto('/signup');
  await expect(page.getByText('회원가입', { exact: true }).first()).toBeVisible();

  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호 (8자 이상)').fill(password);
  await page.getByRole('button', { name: '가입하기' }).click();

  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await expect(page.getByText('회사 등록', { exact: true }).first()).toBeVisible();

  await page.getByLabel('회사명 *').fill(companyName);
  await page.getByLabel('사번 *').fill(empNo);
  await page.getByLabel('이름 *').fill(fullName);
  await page.getByLabel('입사일자 *').fill('2024-01-01');
  await page.getByRole('button', { name: '회사 등록 완료' }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(
    page.getByText(`${fullName} 님 환영합니다`),
  ).toBeVisible();
  await expect(page.getByText(companyName)).toBeVisible();
  await expect(page.getByRole('button', { name: '직원 관리' })).toBeVisible();
});
