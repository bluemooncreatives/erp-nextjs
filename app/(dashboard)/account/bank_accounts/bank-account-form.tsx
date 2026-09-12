'use client';

// Bank account form - port of `account::bank_account.create`.
// Saving also creates the matching ChartAccount under the Bank root.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormTextarea } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { saveBankAccount, type AccountFormState } from '../actions';
import type { BankAccountsRow } from '@/lib/db/schema';

const INITIAL: AccountFormState = {};

export function BankAccountForm({ account }: { account?: BankAccountsRow }) {
  const [state, formAction] = useActionState(saveBankAccount, INITIAL);

  return (
    <Card
      title={account ? 'Edit Bank Account' : 'Add Bank Account'}
      desc="A ledger account is created automatically under the Bank group."
    >
      <form action={formAction} className="space-y-4">
        {account ? <input type="hidden" name="id" value={account.id} /> : null}
        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormInput
          label="Bank Name"
          name="bank_name"
          defaultValue={account?.bankName ?? ''}
          required
          error={state.fieldErrors?.bank_name}
        />
        <FormInput label="Branch Name" name="branch_name" required defaultValue={account?.branchName ?? ''} />
        <FormInput label="Account Name" name="account_name" defaultValue={account?.accountName ?? ''} />
        <FormInput label="Account No" name="account_no" required defaultValue={account?.accountNo ?? ''} />
        <FormTextarea label="Description" name="description" defaultValue={account?.description ?? ''} />

        <SubmitButton>Save Bank Account</SubmitButton>
      </form>
    </Card>
  );
}
