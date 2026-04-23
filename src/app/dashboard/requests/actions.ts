'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ERR: Record<string, string> = {
  NOT_AUTHENTICATED: '로그인이 필요합니다.',
  PROFILE_REQUIRED: '프로필이 없습니다.',
  INVALID_DATE: '사용일자가 올바르지 않습니다.',
  INVALID_DURATION: '시간 단위 값이 올바르지 않습니다.',
  INVALID_DECISION: '결정 값이 올바르지 않습니다.',
  DUPLICATE_DATE: '같은 날짜에 이미 신청 또는 승인된 휴가가 있습니다.',
  INSUFFICIENT_BALANCE: '잔여 일수가 부족합니다.',
  REQUEST_NOT_FOUND: '신청을 찾을 수 없습니다.',
  CROSS_TENANT_FORBIDDEN: '다른 회사 신청은 처리할 수 없습니다.',
  NOT_PENDING: '이미 처리된 신청입니다.',
  NOT_ALLOWED: '권한이 없습니다.',
};

export type SubmitState = { error: string | null; ok: boolean };

export async function submitRequest(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const use_date = String(formData.get('use_date') ?? '').trim();
  const duration = String(formData.get('duration') ?? '').trim();
  const leave_type = String(formData.get('leave_type') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim() || null;

  if (!use_date || !duration || !leave_type) {
    return { error: '사용일자, 시간단위, 종류는 필수입니다.', ok: false };
  }
  if (!['full', 'half_am', 'half_pm'].includes(duration)) {
    return { error: '시간단위 값이 올바르지 않습니다.', ok: false };
  }
  if (!['annual', 'comp', 'special'].includes(leave_type)) {
    return { error: '휴가 종류 값이 올바르지 않습니다.', ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_leave_request', {
    p_use_date: use_date,
    p_duration: duration,
    p_leave_type: leave_type,
    p_reason: reason,
  });

  if (error) {
    const code = error.message.match(/[A-Z_]+/)?.[0] ?? '';
    return { error: ERR[code] ?? `오류: ${error.message}`, ok: false };
  }

  revalidatePath('/dashboard/requests');
  redirect('/dashboard/requests');
}

export async function decideRequest(formData: FormData): Promise<void> {
  const id = String(formData.get('request_id') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  const decided_reason = String(formData.get('decided_reason') ?? '').trim() || null;

  if (!id || !decision) return;

  const supabase = await createClient();
  await supabase.rpc('decide_leave_request', {
    p_request_id: id,
    p_decision: decision,
    p_decided_reason: decided_reason,
  });

  revalidatePath('/dashboard/requests');
}
