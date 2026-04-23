import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '../(auth)/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const TYPE_LABEL: Record<string, string> = {
  annual: '연차',
  comp: '대체휴무',
  special: '특별휴가',
};
const DURATION_LABEL: Record<string, string> = {
  full: '전일',
  half_am: '오전반차',
  half_pm: '오후반차',
};
const STATUS_LABEL: Record<string, { ko: string; cls: string }> = {
  pending: { ko: '대기', cls: 'bg-amber-100 text-amber-800' },
  approved: { ko: '승인', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { ko: '반려', cls: 'bg-rose-100 text-rose-800' },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const myId = user!.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(name)')
    .eq('id', myId)
    .single();

  const isAdmin = profile?.role === 'admin';
  const canManageGrants = profile?.role === 'admin' || profile?.role === 'manager';

  const { data: balances } = await supabase
    .from('leave_balances')
    .select('leave_type, granted_days, used_days, remaining_days')
    .eq('employee_id', myId);

  const { data: recentGrants } = await supabase
    .from('leave_grants')
    .select('id, grant_date, leave_type, days, source, memo')
    .eq('employee_id', myId)
    .order('grant_date', { ascending: false })
    .limit(10);

  const { data: recentRequests } = await supabase
    .from('leave_requests')
    .select('id, use_date, duration, leave_type, status, reason, decided_reason')
    .eq('employee_id', myId)
    .order('use_date', { ascending: false })
    .limit(10);

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">대시보드</h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/requests">
              <Button variant="outline">휴가 신청</Button>
            </Link>
            {canManageGrants && (
              <>
                <Link href="/dashboard/grants">
                  <Button variant="outline">휴가 부여</Button>
                </Link>
                <Link href="/dashboard/balances">
                  <Button variant="outline">전사원 잔여</Button>
                </Link>
              </>
            )}
            {isAdmin && (
              <Link href="/dashboard/employees">
                <Button variant="outline">직원 관리</Button>
              </Link>
            )}
            <form action={logout}>
              <Button variant="outline" type="submit">
                로그아웃
              </Button>
            </form>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{profile?.name} 님 환영합니다</CardTitle>
            <CardDescription>
              {(profile?.companies as { name: string } | null)?.name} ·{' '}
              사번 {profile?.emp_no} · 권한 {profile?.role} · 입사{' '}
              {profile?.hire_date}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          {(['annual', 'comp', 'special'] as const).map((t) => {
            const row = (balances ?? []).find((b) => b.leave_type === t);
            const remaining = Number(row?.remaining_days ?? 0);
            const granted = Number(row?.granted_days ?? 0);
            const used = Number(row?.used_days ?? 0);
            return (
              <Card key={t}>
                <CardHeader>
                  <CardDescription>{TYPE_LABEL[t]}</CardDescription>
                  <CardTitle className="text-3xl">
                    {remaining.toFixed(1)}
                    <span className="ml-1 text-sm font-normal text-slate-500">
                      일 잔여
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">
                  부여 {granted.toFixed(1)} · 사용 {used.toFixed(1)}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>내 사용 이력 (최근 10건)</CardTitle>
            <CardDescription>
              본인이 제출한 신청. 승인된 건만 잔여에서 차감됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(recentRequests ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                아직 신청 내역이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">사용일</th>
                      <th className="py-2 pr-4">단위</th>
                      <th className="py-2 pr-4">종류</th>
                      <th className="py-2 pr-4">상태</th>
                      <th className="py-2 pr-4">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentRequests ?? []).map((r) => {
                      const st = STATUS_LABEL[r.status];
                      return (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono">{r.use_date}</td>
                          <td className="py-2 pr-4">{DURATION_LABEL[r.duration]}</td>
                          <td className="py-2 pr-4">{TYPE_LABEL[r.leave_type]}</td>
                          <td className="py-2 pr-4">
                            <span className={`rounded px-2 py-0.5 text-xs ${st.cls}`}>
                              {st.ko}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-xs text-slate-600">
                            {r.reason ?? ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>내 부여 이력 (최근 10건)</CardTitle>
            <CardDescription>
              자동(auto) + 수동(manual) 부여를 모두 표시.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(recentGrants ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                부여 이력이 없습니다. 관리자가 자동 부여를 실행하면 채워집니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">부여일</th>
                      <th className="py-2 pr-4">종류</th>
                      <th className="py-2 pr-4 text-right">일수</th>
                      <th className="py-2 pr-4">소스</th>
                      <th className="py-2 pr-4">메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentGrants ?? []).map((g) => (
                      <tr key={g.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{g.grant_date}</td>
                        <td className="py-2 pr-4">{TYPE_LABEL[g.leave_type]}</td>
                        <td className="py-2 pr-4 text-right font-mono">
                          {Number(g.days).toFixed(1)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={
                              g.source === 'auto'
                                ? 'rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700'
                                : 'rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700'
                            }
                          >
                            {g.source}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-600">
                          {g.memo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
