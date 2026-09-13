'use client';

// `setup::staff_loans.create` / `.edit` - the apply-for-loan modal, rendered as
// a page-level form. The monthly installment is derived from amount / months,
// exactly as the Blade's `getMonthlyInstallment()` did.

import { useActionState, useState } from 'react';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  FormActions,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeLoan, saveLoan, type LoanFormState } from './actions';
import { Phrase } from '@/context/TranslationContext';

const EMPTY: LoanFormState = {};

export function LoanForm({
  loan,
  departments,
  users,
  currentUserId,
  isSystemUser,
}: {
  loan?: {
    id: number;
    userId: number;
    departmentId: number;
    title: string;
    loanType: string;
    loanDate: string;
    amount: number;
    totalMonth: number;
    monthlyInstallment: number;
    note: string;
  } | null;
  departments: SelectOption[];
  users: SelectOption[];
  currentUserId: number;
  isSystemUser: boolean;
}) {
  const [state, action] = useActionState(loan ? saveLoan : storeLoan, EMPTY);
  const [amount, setAmount] = useState(loan?.amount ?? 0);
  const [months, setMonths] = useState(loan?.totalMonth ?? 0);

  const installment = months > 0 ? Number((amount / months).toFixed(2)) : 0;

  return (
    <form action={action} className="space-y-5">
      {loan ? <input type="hidden" name="id" value={loan.id} /> : null}
      <FormAlert variant="error" message={state.error} />

      {isSystemUser ? (
        <FormSelect
          label="User"
          name="user"
          defaultValue={String(loan?.userId ?? currentUserId)}
          options={users}
          required
        />
      ) : (
        <input type="hidden" name="user" value={currentUserId} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          label="Department"
          name="department_id"
          defaultValue={loan ? String(loan.departmentId) : ''}
          options={departments}
          required
          error={state.fieldErrors?.department_id}
        />
        <FormSelect
          label="Type"
          name="loan_type"
          defaultValue={loan?.loanType ?? 'General'}
          options={[
            { value: 'General', label: 'General' },
            { value: 'Emergency', label: 'Emergency' },
          ]}
          required
          error={state.fieldErrors?.loan_type}
        />
        <FormInput
          label="Title"
          name="title"
          defaultValue={loan?.title ?? ''}
          required
          error={state.fieldErrors?.title}
        />
        <FormInput
          label="Loan Date"
          name="loan_date"
          type="date"
          defaultValue={loan?.loanDate ?? ''}
          required
        />
        <FormInput
          label="Amount"
          name="amount"
          type="number"
          min={0}
          step={1}
          defaultValue={loan?.amount ?? ''}
          onChange={(event) => setAmount(Number(event.target.value) || 0)}
          required
          error={state.fieldErrors?.amount}
        />
        <FormInput
          label="Total Month"
          name="total_month"
          type="number"
          min={0}
          step={1}
          defaultValue={loan?.totalMonth ?? ''}
          onChange={(event) => setMonths(Number(event.target.value) || 0)}
          required
          error={state.fieldErrors?.total_month}
        />
        <FormInput
          label="Monthly Installment"
          name="monthly_installment"
          type="number"
          value={installment || ''}
          readOnly
        />
      </div>

      <FormTextarea label="Description" name="note" rows={4} defaultValue={loan?.note ?? ''} />

      <FormActions>
        <SubmitButton><Phrase>Save</Phrase></SubmitButton>
      </FormActions>
    </form>
  );
}
