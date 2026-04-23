'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type EmployeeFormState = {
  error: string | null;
  ok?: { tempPassword: string; email: string } | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: '로그인이 필요합니다.',
  CALLER_NO_PROFILE: '관리자 프로필을 찾을 수 없습니다.',
  NOT_ADMIN: '관리자만 직원을 등록할 수 있습니다.',
  INVALID_EMP_NO: '사번은 비울 수 없습니다.',
  INVALID_NAME: '이름은 비울 수 없습니다.',
  INVALID_HIRE_DATE: '입사일자는 필수입니다.',
  DUPLICATE_EMP_NO: '같은 회사 안에 이미 존재하는 사번입니다.',
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i += 1) out += chars[arr[i] % chars.length];
  return out + '!9'; // 비밀번호 정책 만족용 보강
}

export async function createEmployee(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const emp_no = String(formData.get('emp_no') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const hire_date = String(formData.get('hire_date') ?? '').trim();
  const birth_date_raw = String(formData.get('birth_date') ?? '').trim();
  const birth_date = birth_date_raw === '' ? null : birth_date_raw;
  const role = (String(formData.get('role') ?? 'employee').trim() as
    | 'employee'
    | 'manager');

  if (!email || !emp_no || !name || !hire_date) {
    return { error: '이메일, 사번, 이름, 입사일자는 필수입니다.', ok: null };
  }
  if (!['employee', 'manager'].includes(role)) {
    return { error: '권한 값이 올바르지 않습니다.', ok: null };
  }

  // 호출자가 admin인지는 RPC가 검증한다. 먼저 caller 세션을 보유한
  // server client로 간단히 confirm (Admin API 남용 방지).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: ERROR_MESSAGES.NOT_AUTHENTICATED, ok: null };

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!callerProfile) return { error: ERROR_MESSAGES.CALLER_NO_PROFILE, ok: null };
  if (callerProfile.role !== 'admin') {
    return { error: ERROR_MESSAGES.NOT_ADMIN, ok: null };
  }

  const tempPassword = generateTempPassword();

  // 1) Admin API로 auth.users 생성 (이메일 자동 승인)
  const admin = createAdminClient();
  const { data: created, error: createUserErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createUserErr || !created?.user) {
    if (createUserErr?.message?.toLowerCase().includes('already')) {
      return { error: '이미 가입된 이메일입니다.', ok: null };
    }
    return { error: `계정 생성 실패: ${createUserErr?.message ?? 'unknown'}`, ok: null };
  }

  const userId = created.user.id;

  // 2) 프로필 생성 (RPC). 실패 시 위에서 만든 auth.users를 정리.
  const { error: rpcErr } = await supabase.rpc('create_employee', {
    p_user_id: userId,
    p_emp_no: emp_no,
    p_name: name,
    p_hire_date: hire_date,
    p_birth_date: birth_date,
    p_role: role,
  });

  if (rpcErr) {
    await admin.auth.admin.deleteUser(userId);
    const code = rpcErr.message.match(/[A-Z_]+/)?.[0] ?? '';
    return { error: ERROR_MESSAGES[code] ?? `오류: ${rpcErr.message}`, ok: null };
  }

  revalidatePath('/dashboard/employees');
  return { error: null, ok: { tempPassword, email } };
}
