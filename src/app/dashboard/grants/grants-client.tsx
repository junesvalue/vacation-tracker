'use client';

import { useActionState } from 'react';
import {
  runAutoGrants,
  createManualGrant,
  type AutoGrantState,
  type ManualGrantState,
} from './actions';
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

const autoInitial: AutoGrantState = { error: null, result: null };
const manualInitial: ManualGrantState = { error: null, ok: false };

export function AutoGrantPanel() {
  const [state, formAction, pending] = useActionState(runAutoGrants, autoInitial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>자동 부여 실행</CardTitle>
        <CardDescription>
          기준일까지의 누락된 자동 연차를 모든 직원에게 일괄 부여. 재실행해도
          누락분만 추가되어 안전합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="as_of">기준일 (비우면 오늘)</Label>
            <Input id="as_of" name="as_of" type="date" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? '처리 중…' : '자동 부여 실행'}
          </Button>

          {state.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}
          {state.result && (
            <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="font-medium text-emerald-900">
                처리 결과: {state.result.length}명 신규 부여
              </p>
              {state.result.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-emerald-800">
                  {state.result.map((r) => (
                    <li key={r.employee_id}>
                      {r.name} ({r.emp_no}) — {r.granted_count}건 / 총{' '}
                      {r.granted_total_days}일
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-emerald-800">
                  추가 부여할 항목이 없습니다 (이미 모두 최신).
                </p>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

type Employee = { id: string; emp_no: string; name: string };

export function ManualGrantPanel({ employees }: { employees: Employee[] }) {
  const [state, formAction, pending] = useActionState(createManualGrant, manualInitial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>수동 부여</CardTitle>
        <CardDescription>
          대체휴무, 특별휴가, 또는 자동 연차를 보정할 때 사용. 직원·종류·일수를
          지정해 한 건 부여.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee_id">직원</Label>
            <select
              id="employee_id"
              name="employee_id"
              required
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">— 선택 —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.emp_no})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grant_date">부여일</Label>
            <Input id="grant_date" name="grant_date" type="date" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="leave_type">종류</Label>
              <select
                id="leave_type"
                name="leave_type"
                required
                defaultValue="comp"
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="annual">연차</option>
                <option value="comp">대체휴무</option>
                <option value="special">특별휴가</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="days">일수</Label>
              <Input
                id="days"
                name="days"
                type="number"
                step="0.5"
                min="0.5"
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="memo">메모 (선택)</Label>
            <Input id="memo" name="memo" placeholder="예: 1/1 휴일근무 보상" />
          </div>

          {state.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p className="text-sm text-emerald-700">부여 완료.</p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? '부여 중…' : '부여하기'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
