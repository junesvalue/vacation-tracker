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

const TYPES = ['annual', 'comp', 'special'] as const;
const TYPE_LABEL: Record<(typeof TYPES)[number], string> = {
  annual: '연차',
  comp: '대체휴무',
  special: '특별휴가',
};

type BalanceRow = {
  employee_id: string;
  leave_type: (typeof TYPES)[number];
  granted_days: number;
  used_days: number;
  remaining_days: number;
};

type ProfileRow = {
  id: string;
  emp_no: string;
  name: string;
  hire_date: string;
  role: string;
};

export default async function BalancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (me?.role !== 'admin' && me?.role !== 'manager') redirect('/dashboard');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, emp_no, name, hire_date, role')
    .order('emp_no');

  const { data: balances } = await supabase
    .from('leave_balances')
    .select('employee_id, leave_type, granted_days, used_days, remaining_days');

  const balanceMap = new Map<string, Map<string, BalanceRow>>();
  for (const b of (balances ?? []) as BalanceRow[]) {
    if (!balanceMap.has(b.employee_id)) {
      balanceMap.set(b.employee_id, new Map());
    }
    balanceMap.get(b.employee_id)!.set(b.leave_type, b);
  }

  const rows = (profiles ?? []) as ProfileRow[];

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">전사원 잔여</h1>
          <Link href="/dashboard">
            <Button variant="outline">대시보드</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>잔여 현황 ({rows.length}명)</CardTitle>
            <CardDescription>
              종류별 부여·사용·잔여를 한눈에 확인. 잔여 0 이하인 칸은 강조
              표시. 데이터는 view `leave_balances` 가 실시간으로 계산.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4" rowSpan={2}>사번</th>
                    <th className="py-2 pr-4" rowSpan={2}>이름</th>
                    <th className="py-2 pr-4" rowSpan={2}>입사일</th>
                    <th className="py-2 pr-4" rowSpan={2}>권한</th>
                    {TYPES.map((t) => (
                      <th key={t} className="border-l py-2 pr-4 pl-3 text-center" colSpan={3}>
                        {TYPE_LABEL[t]}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-xs">
                    {TYPES.flatMap((t) => [
                      <th key={`${t}-g`} className="border-l py-1 pr-2 pl-3 text-right font-normal">
                        부여
                      </th>,
                      <th key={`${t}-u`} className="py-1 pr-2 text-right font-normal">
                        사용
                      </th>,
                      <th key={`${t}-r`} className="py-1 pr-4 text-right font-normal">
                        잔여
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const empBalances = balanceMap.get(p.id);
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{p.emp_no}</td>
                        <td className="py-2 pr-4">{p.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{p.hire_date}</td>
                        <td className="py-2 pr-4">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                            {p.role}
                          </span>
                        </td>
                        {TYPES.flatMap((t) => {
                          const b = empBalances?.get(t);
                          const granted = Number(b?.granted_days ?? 0);
                          const used = Number(b?.used_days ?? 0);
                          const remaining = Number(b?.remaining_days ?? 0);
                          const lowCls =
                            remaining <= 0 ? 'text-rose-600 font-semibold' : '';
                          return [
                            <td
                              key={`${p.id}-${t}-g`}
                              className="border-l py-2 pr-2 pl-3 text-right font-mono"
                            >
                              {granted.toFixed(1)}
                            </td>,
                            <td
                              key={`${p.id}-${t}-u`}
                              className="py-2 pr-2 text-right font-mono"
                            >
                              {used.toFixed(1)}
                            </td>,
                            <td
                              key={`${p.id}-${t}-r`}
                              className={`py-2 pr-4 text-right font-mono ${lowCls}`}
                            >
                              {remaining.toFixed(1)}
                            </td>,
                          ];
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
