import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { decideRequest } from './actions';

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

type RequestRow = {
  id: string;
  employee_id: string;
  use_date: string;
  duration: 'full' | 'half_am' | 'half_pm';
  leave_type: 'annual' | 'comp' | 'special';
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  decided_reason: string | null;
  submitted_at: string;
  decided_at: string | null;
  profiles: { emp_no: string; name: string } | { emp_no: string; name: string }[] | null;
};

function pickProfile(p: RequestRow['profiles']): { emp_no: string; name: string } | null {
  if (!p) return null;
  return Array.isArray(p) ? p[0] ?? null : p;
}

function RequestTable({
  rows,
  canDecide,
  myId,
  emptyText,
}: {
  rows: RequestRow[];
  canDecide: boolean;
  myId: string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-slate-500">
          <tr>
            <th className="py-2 pr-4">사용일</th>
            <th className="py-2 pr-4">신청자</th>
            <th className="py-2 pr-4">단위</th>
            <th className="py-2 pr-4">종류</th>
            <th className="py-2 pr-4">사유</th>
            <th className="py-2 pr-4">상태</th>
            <th className="py-2 pr-4">처리</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = pickProfile(r.profiles);
            const st = STATUS_LABEL[r.status];
            const isMyPending = r.employee_id === myId && r.status === 'pending';
            return (
              <tr key={r.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-4 font-mono">{r.use_date}</td>
                <td className="py-2 pr-4">
                  {p?.name}{' '}
                  <span className="text-xs text-slate-500">({p?.emp_no})</span>
                </td>
                <td className="py-2 pr-4">{DURATION_LABEL[r.duration]}</td>
                <td className="py-2 pr-4">{TYPE_LABEL[r.leave_type]}</td>
                <td className="py-2 pr-4 max-w-[200px] truncate text-xs text-slate-600">
                  {r.reason ?? ''}
                </td>
                <td className="py-2 pr-4">
                  <span className={`rounded px-2 py-0.5 text-xs ${st.cls}`}>
                    {st.ko}
                  </span>
                  {r.decided_reason && (
                    <p className="mt-1 text-xs text-slate-500">
                      {r.decided_reason}
                    </p>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {r.status === 'pending' && (canDecide || isMyPending) && (
                    <div className="flex flex-wrap gap-1">
                      {canDecide && (
                        <>
                          <form action={decideRequest}>
                            <input type="hidden" name="request_id" value={r.id} />
                            <input type="hidden" name="decision" value="approved" />
                            <Button type="submit" size="sm" variant="default">
                              승인
                            </Button>
                          </form>
                          <form action={decideRequest}>
                            <input type="hidden" name="request_id" value={r.id} />
                            <input type="hidden" name="decision" value="rejected" />
                            <Button type="submit" size="sm" variant="outline">
                              반려
                            </Button>
                          </form>
                        </>
                      )}
                      {isMyPending && !canDecide && (
                        <form action={decideRequest}>
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <Button type="submit" size="sm" variant="outline">
                            취소
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  const canDecide = me?.role === 'admin' || me?.role === 'manager';

  const baseSelect =
    'id, employee_id, use_date, duration, leave_type, status, reason, decided_reason, submitted_at, decided_at, profiles!leave_requests_employee_id_fkey(emp_no, name)';

  const { data: myRequests } = await supabase
    .from('leave_requests')
    .select(baseSelect)
    .eq('employee_id', user!.id)
    .order('use_date', { ascending: false })
    .limit(50);

  const { data: pending } = canDecide
    ? await supabase
        .from('leave_requests')
        .select(baseSelect)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true })
    : { data: [] };

  const { data: recent } = canDecide
    ? await supabase
        .from('leave_requests')
        .select(baseSelect)
        .neq('status', 'pending')
        .order('decided_at', { ascending: false })
        .limit(20)
    : { data: [] };

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">휴가 신청</h1>
          <div className="flex gap-2">
            <Link href="/dashboard">
              <Button variant="outline">대시보드</Button>
            </Link>
            <Link href="/dashboard/requests/new">
              <Button>새 신청</Button>
            </Link>
          </div>
        </div>

        {canDecide && (
          <Card>
            <CardHeader>
              <CardTitle>승인 대기 ({(pending ?? []).length}건)</CardTitle>
              <CardDescription>
                회사 전체 직원의 미처리 신청. 승인 시 잔여가 차감되고, 반려 시
                보존됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestTable
                rows={(pending ?? []) as RequestRow[]}
                canDecide
                myId={user!.id}
                emptyText="대기 중인 신청이 없습니다."
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>내 신청 (최근 50건)</CardTitle>
            <CardDescription>
              본인이 직접 제출한 신청. 대기 중인 건은 본인이 취소(반려) 가능.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequestTable
              rows={(myRequests ?? []) as RequestRow[]}
              canDecide={false}
              myId={user!.id}
              emptyText="아직 신청 내역이 없습니다."
            />
          </CardContent>
        </Card>

        {canDecide && (
          <Card>
            <CardHeader>
              <CardTitle>최근 처리됨 (최대 20건)</CardTitle>
              <CardDescription>
                전사원 대상으로 최근에 승인/반려된 신청.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestTable
                rows={(recent ?? []) as RequestRow[]}
                canDecide={false}
                myId={user!.id}
                emptyText="처리된 신청이 없습니다."
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
