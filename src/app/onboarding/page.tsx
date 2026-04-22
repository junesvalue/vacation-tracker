'use client';

import { useActionState } from 'react';
import { createCompany, type OnboardingState } from './actions';
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

const initialState: OnboardingState = { error: null };

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(createCompany, initialState);

  return (
    <div className="min-h-svh flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>회사 등록</CardTitle>
          <CardDescription>
            연차 관리를 시작하기 위해 회사와 본인 정보를 입력하세요. 본인은
            관리자(admin) 권한으로 등록됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="company_name">회사명 *</Label>
              <Input id="company_name" name="company_name" required />
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

            {state.error && (
              <p className="text-sm text-red-600" role="alert">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending}>
              {pending ? '등록 중…' : '회사 등록 완료'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
