'use client';

// Contra voucher form - port of `account::contra_voucher.create`.

import { useActionState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { ROUTES } from '@/lib/routes';
import { storeContraVoucher, type AccountFormState } from '../../actions';

const INITIAL: AccountFormState = {};

export function ContraVoucherForm({ accounts }: { accounts: SelectOption[] }) {
  const [state, formAction] = useActionState(storeContraVoucher, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="is_approve" value="1" />

      <FormAlert variant="error" message={state.error} />

      <Card
        title="Transfer Between Accounts"
        desc="The amount leaves the source account and arrives in the destination account."
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="From account"
            name="from_account_id"
            required
            placeholder="Select account"
            options={accounts}
            error={state.fieldErrors?.from_account_id}
          />
          <FormSelect
            label="To account"
            name="to_account_id"
            required
            placeholder="Select account"
            options={accounts}
            error={state.fieldErrors?.to_account_id}
          />
          <FormInput
            label="Amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            error={state.fieldErrors?.amount}
          />
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <FormTextarea label="Narration" name="narration" wrapperClassName="mt-5" />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['contra.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton>Save Contra Voucher</SubmitButton>
      </div>
    </form>
  );
}
