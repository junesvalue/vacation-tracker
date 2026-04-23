'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createEmployee, type EmployeeFormState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const initialState: EmployeeFormState = { error: null, ok: null };

export default function NewEmployeePage() {
  const [state, formAction, pending] = useActionState(createEmployee, initialState);

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">직원 등록</h1>
          <Link href="/dashboard/employees">
            <Button variant="outline">목록으로</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>새 직원 추가</CardTitle>
            <CardDescription>
              임시 비밀번호가 화면에 한 번만 표시됩니다. 직원에게 안전하게
              전달하고, 첫 로그인 후 변경하도록 안내하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">이메일 *</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp_no">사번 *</Label>
                <Input id="emp_no" name="emp_no" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">이름 *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="hire_date">입사일자 *</Label>
                <Input id="hire_date" name="hire_date" type="date" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="birth_date">생년월일</Label>
                <Input id="birth_date" name="birth_date" type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="role">권한</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue="employee"
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="employee">employee (일반 직원)</option>
                  <option value="manager">manager (부서장 — 승인 권한)</option>
                </select>
              </div>

              {state.error && (
                <p className="text-sm text-red-600" role="alert">
                  {state.error}
                </p>
              )}
              {state.ok && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <p className="font-medium text-emerald-900">
                    등록 완료 — 임시 비밀번호:
                  </p>
                  <p className="mt-1 break-all font-mono text-emerald-900">
                    {state.ok.tempPassword}
                  </p>
                  <p className="mt-2 text-xs text-emerald-700">
                    이메일 {state.ok.email} 로 로그인 안내해주세요. 이 비밀번호는
                    이 화면을 떠나면 다시 볼 수 없습니다.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={pending}>
                {pending ? '등록 중…' : '등록하기'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
