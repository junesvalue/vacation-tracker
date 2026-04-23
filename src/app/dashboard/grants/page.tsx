import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AutoGrantPanel, ManualGrantPanel } from './grants-client';

const TYPE_LABEL: Record<string, string> = {
  annual: '연차',
  comp: '대체휴무',
  special: '특별휴가',
};

export default async function GrantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (me?.role !== 'admin' && me?.role !== 'manager') redirect('/dashboard');

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, emp_no, name, hire_date')
    .order('emp_no');

  const { data: grants } = await supabase
    .from('leave_grants')
    .select('id, grant_date, leave_type, days, source, memo, profiles(emp_no, name)')
    .order('grant_date', { ascending: false })
    .limit(100);

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">휴가 부여 관리</h1>
          <Link href="/dashboard">
            <Button variant="outline">대시보드</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AutoGrantPanel />
          <ManualGrantPanel
            employees={employees ?? []}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>최근 부여 이력 (최대 100건)</CardTitle>
            <CardDescription>
              자동 부여(auto) 와 수동 부여(manual) 모두 표시. 잔여 계산은 view
              `leave_balances` 가 실시간으로 처리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">부여일</th>
                    <th className="py-2 pr-4">직원</th>
                    <th className="py-2 pr-4">종류</th>
                    <th className="py-2 pr-4 text-right">일수</th>
                    <th className="py-2 pr-4">소스</th>
                    <th className="py-2 pr-4">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {(grants ?? []).map((g) => {
                    const raw = g.profiles as unknown as
                      | { emp_no: string; name: string }
                      | { emp_no: string; name: string }[]
                      | null;
                    const p = Array.isArray(raw) ? raw[0] ?? null : raw;
                    return (
                      <tr key={g.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{g.grant_date}</td>
                        <td className="py-2 pr-4">
                          {p?.name}{' '}
                          <span className="text-xs text-slate-500">
                            ({p?.emp_no})
                          </span>
                        </td>
                        <td className="py-2 pr-4">{TYPE_LABEL[g.leave_type] ?? g.leave_type}</td>
                        <td className="py-2 pr-4 text-right font-mono">{g.days}</td>
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
                    );
                  })}
                  {(grants ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        부여 이력이 아직 없습니다. 위에서 자동 부여를 실행하세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
