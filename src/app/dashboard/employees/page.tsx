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

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (me?.role !== 'admin') redirect('/dashboard');

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, emp_no, name, hire_date, birth_date, role, created_at')
    .order('created_at', { ascending: true });

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">직원 관리</h1>
          <div className="flex gap-2">
            <Link href="/dashboard">
              <Button variant="outline">대시보드</Button>
            </Link>
            <Link href="/dashboard/employees/new">
              <Button>직원 등록</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>직원 {employees?.length ?? 0}명</CardTitle>
            <CardDescription>
              본인을 포함한 모든 회사 구성원. 등록된 임시 비밀번호로 첫 로그인
              후 본인이 비밀번호를 변경하도록 안내하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">사번</th>
                    <th className="py-2 pr-4">이름</th>
                    <th className="py-2 pr-4">입사일</th>
                    <th className="py-2 pr-4">생년월일</th>
                    <th className="py-2 pr-4">권한</th>
                  </tr>
                </thead>
                <tbody>
                  {(employees ?? []).map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono">{e.emp_no}</td>
                      <td className="py-2 pr-4">{e.name}</td>
                      <td className="py-2 pr-4">{e.hire_date}</td>
                      <td className="py-2 pr-4">{e.birth_date ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                          {e.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
