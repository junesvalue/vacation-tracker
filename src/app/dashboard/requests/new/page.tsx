'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitRequest, type SubmitState } from '../actions';
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

const initialState: SubmitState = { error: null, ok: false };

export default function NewRequestPage() {
  const [state, formAction, pending] = useActionState(submitRequest, initialState);

  return (
    <div className="min-h-svh bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">새 휴가 신청</h1>
          <Link href="/dashboard/requests">
            <Button variant="outline">목록으로</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>신청서</CardTitle>
            <CardDescription>
              제출 후 부서장/관리자가 승인하면 잔여에서 자동 차감됩니다. 본인이
              대기 중인 신청은 직접 취소할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="use_date">사용일자 *</Label>
                <Input id="use_date" name="use_date" type="date" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="duration">시간 단위 *</Label>
                <select
                  id="duration"
                  name="duration"
                  defaultValue="full"
                  required
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="full">전일 (1.0일)</option>
                  <option value="half_am">오전반차 (0.5일)</option>
                  <option value="half_pm">오후반차 (0.5일)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="leave_type">휴가 종류 *</Label>
                <select
                  id="leave_type"
                  name="leave_type"
                  defaultValue="annual"
                  required
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="annual">연차</option>
                  <option value="comp">대체휴무</option>
                  <option value="special">특별휴가</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="reason">사유 (선택)</Label>
                <Input id="reason" name="reason" placeholder="예: 개인 사정" />
              </div>

              {state.error && (
                <p className="text-sm text-red-600" role="alert">
                  {state.error}
                </p>
              )}

              <Button type="submit" disabled={pending}>
                {pending ? '제출 중…' : '신청'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
