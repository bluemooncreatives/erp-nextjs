'use client';

// Payment panel - port of `sale::sale.sale_payment_modal`.

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { addSalePayment, type SaleFormState } from '../../actions';

const INITIAL: SaleFormState = {};

export function PaymentPanel({
  saleId,
  dueAmount,
  currencySymbol,
  accounts,
}: {
  saleId: number;
  dueAmount: number;
  currencySymbol: string;
  accounts: SelectOption[];
}) {
  const [state, formAction] = useActionState(addSalePayment, INITIAL);
  const [method, setMethod] = useState('cash');

  const needsAccount = method !== 'cash' && method !== 'quick cash';

  return (
    <Card title="Add Payment" desc={`Due: ${currencySymbol} ${dueAmount.toFixed(2)}`}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="sale_id" value={saleId} />

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
            { value: 'quick cash', label: 'Quick Cash' },
            { value: 'bank', label: 'Bank' },
            { value: 'cheque', label: 'Cheque' },
            { value: 'card', label: 'Card' },
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

        {needsAccount ? (
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
