'use client';

// Generate payroll - port of PayrollController@generatePayroll / savePayrollData.
//
// Selecting a staff member fills the basic salary and bank details from their
// record, then earning and deduction lines are added before saving.

import { useActionState, useEffect, useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { storePayroll, type LeaveFormState } from '../../leave/actions';
import { PayrollLineKind, isEarningLine } from '@/lib/hr/payroll-lines';
import { Phrase } from '@/context/TranslationContext';

const INITIAL: LeaveFormState = {};

export type PayableStaff = {
  id: number;
  name: string;
  employeeId: string | null;
  basicSalary: number;
  roleId: number;
  bankName: string | null;
  bankBranchName: string | null;
  accountNo: string | null;
  /** `ApplyLoan::Nonpaid()` - offered as ready-made deduction lines below. */
  loans: Array<{
    id: number;
    title: string | null;
    amount: number;
    paidLoanAmount: number;
    monthlyInstallment: number;
  }>;
};

type Line = {
  key: number;
  typeName: string;
  amount: number;
  kind: string;
  /** Set for a loan-seeded row; ties this deduction back to that loan. */
  loanId?: number;
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export function GeneratePayrollPanel({
  staff,
  currencySymbol,
}: {
  staff: PayableStaff[];
  currencySymbol: string;
}) {
  const [state, formAction] = useActionState(storePayroll, INITIAL);
  const [staffId, setStaffId] = useState('');
  const [tax, setTax] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);

  const selected = staff.find((s) => String(s.id) === staffId) ?? null;
  const basic = selected?.basicSalary ?? 0;

  // The Blade reloaded the whole form for the chosen staff, with one
  // deduction row already sitting in the table per unpaid loan they carry,
  // pre-filled with that loan's monthly installment. Switching staff here
  // does the same - old lines are staff-specific and don't carry over.
  useEffect(() => {
    const loans = staff.find((s) => String(s.id) === staffId)?.loans ?? [];
    setLines(
      loans.map((loan) => ({
        key: loan.id,
        typeName: `${loan.title ?? 'Loan'} - Loan`,
        amount: Math.min(loan.monthlyInstallment, loan.amount - loan.paidLoanAmount),
        kind: PayrollLineKind.Deduction,
        loanId: loan.id,
      })),
    );
  }, [staffId, staff]);

  // The preview has to total the same way the action does, so it shares the
  // server's reading of `earn_dedc_type`.
  const earnings = lines
    .filter((line) => isEarningLine(line.kind))
    .reduce((sum, line) => sum + line.amount, 0);
  const deductions = lines
    .filter((line) => !isEarningLine(line.kind))
    .reduce((sum, line) => sum + line.amount, 0);

  const gross = basic + earnings;
  const net = gross - deductions - tax;

  const money = (v: number) => `${currencySymbol} ${v.toFixed(2)}`;
  const now = new Date();

  const patch = (key: number, value: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...value } : l)));

  return (
    <form action={formAction}>
      <input type="hidden" name="role_id" value={selected?.roleId ?? 1} />
      <input type="hidden" name="basic_salary" value={basic} />

      <Card title="Generate Payroll">
        <FormAlert variant="error" message={state.error} />

        <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="Staff"
            name="staff_id"
            required
            placeholder="Select staff"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            options={staff.map((s) => ({
              value: s.id,
              label: `${s.name}${s.employeeId ? ` (${s.employeeId})` : ''}`,
            }))}
            error={state.fieldErrors?.staff_id}
          />
          <FormSelect
            label="Month"
            name="payroll_month"
            defaultValue={MONTHS[now.getUTCMonth()]}
            options={MONTHS.map((m) => ({ value: m, label: m }))}
          />
          <FormInput
            label="Year"
            name="payroll_year"
            type="number"
            min="2000"
            max="2100"
            defaultValue={String(now.getUTCFullYear())}
          />
          <FormInput
            label="Basic Salary"
            name="_basic_display"
            value={basic}
            readOnly
            disabled
          />
        </div>

        <div className="mt-5 space-y-3">
          {lines.map((line) => (
            <div key={line.key} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="loan_id" value={line.loanId ?? ''} />
              <div>
                <FormInput
                  label="Description"
                  name="type_name"
                  value={line.typeName}
                  readOnly={Boolean(line.loanId)}
                  onChange={(e) => patch(line.key, { typeName: e.target.value })}
                />
                {line.loanId ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Phrase>Loan repayment</Phrase>
                  </p>
                ) : null}
              </div>
              <FormSelect
                label="Type"
                name="earn_dedc_type"
                value={line.kind}
                onChange={(e) => patch(line.key, { kind: e.target.value })}
                // 'E' / 'D' are what `payroll_earn_deducs.earn_dedc_type`
                // holds and what the payroll reports filter on.
                options={[
                  { value: 'E', label: 'Earning' },
                  { value: 'D', label: 'Deduction' },
                ]}
              />
              <FormInput
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                value={line.amount}
                onChange={(e) => patch(line.key, { amount: Number(e.target.value) })}
              />
              <div className="flex items-end pb-1">
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) => prev.filter((l) => l.key !== line.key))
                  }
                  className="rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <Phrase>{line.loanId ? "Don't deduct this month" : 'Remove'}</Phrase>
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { key: Date.now(), typeName: '', amount: 0, kind: 'E' },
            ])
          }
          className="mt-4 rounded-lg px-4 py-2.5 text-sm font-medium text-primary ring-1 ring-inset ring-ring/50 hover:bg-primary/10"
        >
          Add earning / deduction
        </button>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormInput
            label="Tax"
            name="tax"
            type="number"
            step="0.01"
            min="0"
            value={tax}
            onChange={(e) => setTax(Number(e.target.value))}
          />
          <FormSelect
            label="Payment Mode"
            name="payment_mode"
            placeholder="Select"
            options={[
              { value: 'Cash', label: 'Cash' },
              { value: 'Bank', label:'Bank' },
              { value: 'Cheque', label:'Cheque' },
            ]}
          />
          <FormInput label="Payment Date" name="payment_date" type="date" />
          <FormInput label="Cheque No" name="cheque_no" />
          <FormInput
            label="Bank Name"
            name="bank_name"
            defaultValue={selected?.bankName ?? ''}
            key={`bank-${staffId}`}
          />
          <FormInput
            label="Bank Branch"
            name="bank_branch_name"
            defaultValue={selected?.bankBranchName ?? ''}
            key={`branch-${staffId}`}
          />
          <FormInput
            label="Account No"
            name="account_no"
            defaultValue={selected?.accountNo ?? ''}
            key={`acc-${staffId}`}
          />
          <FormInput label="Note" name="note" />
        </div>

        <DataTable
          columns={[
            { label: 'Basic' },
            { label: 'Earnings' },
            { label: 'Gross' },
            { label: 'Deductions' },
            { label: 'Tax' },
            { label: 'Net' },
          ]}
          isEmpty={false}
        >
          <Tr>
            <Td>{money(basic)}</Td>
            <Td>{money(earnings)}</Td>
            <Td>{money(gross)}</Td>
            <Td>{money(deductions)}</Td>
            <Td>{money(tax)}</Td>
            <Td className="font-semibold">{money(net)}</Td>
          </Tr>
        </DataTable>

        <div className="mt-5">
          <SubmitButton disabled={!staffId}><Phrase>Generate Payroll</Phrase></SubmitButton>
        </div>
      </Card>
    </form>
  );
}
