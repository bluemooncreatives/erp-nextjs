'use client';

// Payroll payment - port of the `PaymentForm` modal `PayrollController@paymentPayroll`
// rendered, posting to `payroll_payment_store`.
//
// A `<details>` disclosure rather than a modal, so the row it belongs to stays
// obvious and the form still works with scripting off.

import { useActionState, useState } from 'react';
import { FormAlert, FormInput, FormSelect } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { payPayrollAction, type LeaveFormState } from '../../leave/actions';

const INITIAL: LeaveFormState = {};

export function PayrollPaymentPanel({
  payrollId,
  netSalary,
  currencySymbol,
}: {
  payrollId: number;
  netSalary: number;
  currencySymbol: string;
}) {
  const [state, formAction] = useActionState(payPayrollAction, INITIAL);
  const [mode, setMode] = useState<'Cash' | 'Bank' | 'Cheque'>('Cash');

  return (
    <details className="relative inline-block">
      <summary className="cursor-pointer text-xs font-medium text-primary hover:text-primary">
        Pay
      </summary>
      <form
        action={formAction}
        className="absolute right-0 z-10 mt-2 w-72 space-y-3 rounded-lg border border-border bg-card p-4 text-start shadow-lg"
      >
        <p className="text-sm font-medium text-foreground">
          Pay {currencySymbol} {netSalary.toFixed(2)}
        </p>
        <input type="hidden" name="payroll_generate_id" value={payrollId} />

        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormInput
          label="Payment Date"
          name="payment_date"
          id={`payment_date-${payrollId}`}
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          error={state.fieldErrors?.payment_date}
        />

        <FormSelect
          label="Payment Method"
          name="payment_mode"
          id={`payment_mode-${payrollId}`}
          required
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          error={state.fieldErrors?.payment_mode}
          options={[
            { value: 'Cash', label: 'Cash' },
            { value: 'Bank', label: 'Bank' },
            { value: 'Cheque', label: 'Cheque' },
          ]}
        />

        {mode === 'Bank' ? (
          <>
            <FormInput label="Bank Name" name="bank_name" id={`bank_name-${payrollId}`} required />
            <FormInput label="Branch Name" name="bank_branch_name" id={`bank_branch_name-${payrollId}`} required />
            <FormInput label="Account No" name="account_no" id={`account_no-${payrollId}`} required />
          </>
        ) : null}

        {mode === 'Cheque' ? (
          <FormInput label="Cheque No" name="cheque_no" id={`cheque_no-${payrollId}`} required />
        ) : null}

        <FormInput label="Note" name="note" id={`note-${payrollId}`} />

        <SubmitButton size="sm" className="w-full justify-center">
          Pay Now
        </SubmitButton>
      </form>
    </details>
  );
}
