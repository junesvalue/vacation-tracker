'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type OnboardingState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: '로그인이 필요합니다.',
  PROFILE_ALREADY_EXISTS: '이미 회사가 등록된 계정입니다.',
  INVALID_COMPANY_NAME: '회사명을 입력해주세요.',
  INVALID_EMP_NO: '사번을 입력해주세요.',
  INVALID_NAME: '이름을 입력해주세요.',
};

export async function createCompany(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const company_name = String(formData.get('company_name') ?? '').trim();
  const emp_no = String(formData.get('emp_no') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const hire_date = String(formData.get('hire_date') ?? '').trim();
  const birth_date_raw = String(formData.get('birth_date') ?? '').trim();
  const birth_date = birth_date_raw === '' ? null : birth_date_raw;

  if (!company_name || !emp_no || !name || !hire_date) {
    return { error: '회사명, 사번, 이름, 입사일자는 필수입니다.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_company_with_admin', {
    p_company_name: company_name,
    p_emp_no: emp_no,
    p_name: name,
    p_hire_date: hire_date,
    p_birth_date: birth_date,
  });

  if (error) {
    const code = error.message.match(/[A-Z_]+/)?.[0] ?? '';
    return { error: ERROR_MESSAGES[code] ?? `오류: ${error.message}` };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
