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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(name)')
    .eq('id', user!.id)
    .single();

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">대시보드</h1>
          <form action={logout}>
            <Button variant="outline" type="submit">
              로그아웃
            </Button>
          </form>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{profile?.name} 님 환영합니다</CardTitle>
            <CardDescription>
              {(profile?.companies as { name: string } | null)?.name} ·{' '}
              사번 {profile?.emp_no} · 권한 {profile?.role}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>입사일: {profile?.hire_date}</p>
            <p>생년월일: {profile?.birth_date ?? '미입력'}</p>
            <p className="pt-2 text-xs text-slate-500">
              4단계에서 직원 등록·연차 부여 화면이 추가됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
