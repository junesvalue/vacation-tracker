'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: '로그인이 필요합니다.',
  NOT_ALLOWED: '관리자 또는 부서장만 실행할 수 있습니다.',
  EMPLOYEE_NOT_FOUND: '직원을 찾을 수 없습니다.',
  CROSS_TENANT_FORBIDDEN: '다른 회사 직원은 처리할 수 없습니다.',
  INVALID_DAYS: '일수는 0보다 커야 합니다.',
};

export type AutoGrantRow = {
  employee_id: string;
  emp_no: string;
  name: string;
  granted_count: number;
  granted_total_days: number;
};

export type AutoGrantState = {
  error: string | null;
  result: AutoGrantRow[] | null;
};

export async function runAutoGrants(
  _prev: AutoGrantState,
  formData: FormData,
): Promise<AutoGrantState> {
  const asOf = String(formData.get('as_of') ?? '').trim();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    'process_auto_grants',
    asOf ? { p_as_of: asOf } : {},
  );

  if (error) {
    const code = error.message.match(/[A-Z_]+/)?.[0] ?? '';
    return { error: ERROR_MESSAGES[code] ?? `오류: ${error.message}`, result: null };
  }

  revalidatePath('/dashboard/grants');
  return { error: null, result: (data ?? []) as AutoGrantRow[] };
}

export type ManualGrantState = { error: string | null; ok: boolean };

export async function createManualGrant(
  _prev: ManualGrantState,
  formData: FormData,
): Promise<ManualGrantState> {
  const employee_id = String(formData.get('employee_id') ?? '').trim();
  const grant_date = String(formData.get('grant_date') ?? '').trim();
  const leave_type = String(formData.get('leave_type') ?? '').trim();
  const daysStr = String(formData.get('days') ?? '').trim();
  const memo = String(formData.get('memo') ?? '').trim() || null;

  if (!employee_id || !grant_date || !leave_type || !daysStr) {
    return { error: '직원, 부여일, 종류, 일수는 필수입니다.', ok: false };
  }
  if (!['annual', 'comp', 'special'].includes(leave_type)) {
    return { error: '휴가 종류 값이 올바르지 않습니다.', ok: false };
  }
  const days = Number(daysStr);
  if (!Number.isFinite(days) || days <= 0) {
    return { error: '일수는 0보다 큰 숫자여야 합니다.', ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_manual_grant', {
    p_employee_id: employee_id,
    p_grant_date: grant_date,
    p_leave_type: leave_type,
    p_days: days,
    p_memo: memo,
  });

  if (error) {
    const code = error.message.match(/[A-Z_]+/)?.[0] ?? '';
    return { error: ERROR_MESSAGES[code] ?? `오류: ${error.message}`, ok: false };
  }

  revalidatePath('/dashboard/grants');
  return { error: null, ok: true };
}
