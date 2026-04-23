import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-only admin client. Bypasses RLS and Auth restrictions.
 * NEVER import this from client components.
 *
 * Usage: 직원 계정 생성 (auth.admin.createUser), 비활성화 등.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
