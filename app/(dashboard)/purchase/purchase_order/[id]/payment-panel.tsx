'use client';

// Purchase payment panel - port of the payment modal on the purchase screen.

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { addPurchasePayment, type PurchaseFormState } from '../../actions';

const INITIAL: PurchaseFormState = {};

export function PurchasePaymentPanel({
  purchaseId,
  dueAmount,
  currencySymbol,
  accounts,
}: {
  purchaseId: number;
  dueAmount: number;
  currencySymbol: string;
  accounts: SelectOption[];
}) {
  const [state, formAction] = useActionState(addPurchasePayment, INITIAL);
  const [method, setMethod] = useState('cash');

  return (
    <Card title="Add Payment" desc={`Due: ${currencySymbol} ${dueAmount.toFixed(2)}`}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="purchase_id" value={purchaseId} />

        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormSelect
          label="Payment Method"
          name="payment_method"
          required
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'bank', label: 'Bank' },
            { value: 'cheque', label: 'Cheque' },
          ]}
        />

        <FormInput
          label="Amount"
          name="payment_amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={dueAmount.toFixed(2)}
        />

        {method !== 'cash' ? (
          <>
            <FormSelect
              label="Bank Account"
              name="account_id"
              placeholder="Select account"
              options={accounts}
            />
            <FormInput label="Bank Name" name="bank_name" />
            <FormInput label="Branch" name="branch" />
          </>
        ) : null}

        <SubmitButton className="w-full justify-center">Record Payment</SubmitButton>
      </form>
    </Card>
  );
}
