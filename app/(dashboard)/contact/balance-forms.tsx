'use client';

// The "Add Balance" and "Subtract Balance" modals of the contact detail screens
// (contact::contact.add_balance_modal_* / minus_balance_modal_*), as inline
// forms. The cheque and bank fields follow the modal's jQuery: they are only
// shown once a bank account is chosen.

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect, type SelectOption } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import type { BalanceFormState } from './balance-actions';

const INITIAL: BalanceFormState = {};

export type BalanceAccountOption = SelectOption & { isBank: boolean };

export function AddBalanceForm({
  action,
  contactId,
  contactAccountName,
  accounts,
  /** The customer form picks the receiving account; the supplier one the paying account. */
  accountField,
  accountLabel,
  contactFieldLabel,
  title,
}: {
  action: (prev: BalanceFormState, formData: FormData) => Promise<BalanceFormState>;
  contactId: number;
  contactAccountName: string;
  accounts: BalanceAccountOption[];
  accountField: 'debit_account_id' | 'credit_account_id';
  accountLabel: string;
  contactFieldLabel: string;
  title: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const [accountId, setAccountId] = useState('');

  const isBank = accounts.find((a) => String(a.value) === accountId)?.isBank ?? false;

  return (
    <Card title={title}>
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="contact_id" value={contactId} />
        <FormAlert message={state.error} />
        <FormAlert message={state.success} variant="success" />

        <div className="grid gap-5 md:grid-cols-3">
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            error={state.fieldErrors?.date}
          />
          <FormInput
            label={contactFieldLabel}
            name="contact_account_name"
            defaultValue={contactAccountName}
            readOnly
          />
          <FormSelect
            label={accountLabel}
            name={accountField}
            required
            placeholder="Select one"
            options={accounts}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            error={state.fieldErrors?.[accountField]}
          />
          <FormInput
            label="Amount"
            name="debit_account_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            error={state.fieldErrors?.debit_account_amount}
          />
          <FormInput label="Narration" name="debit_account_narration" />
        </div>

        {isBank ? (
          <div className="grid gap-5 md:grid-cols-4">
            <FormInput label="Cheque Number" name="cheque_no" />
            <FormInput label="Cheque Date" name="cheque_date" type="date" />
            <FormInput label="Bank Name" name="bank_name" />
            <FormInput label="Bank Branch" name="bank_branch" />
          </div>
        ) : null}

        <SubmitButton>Add Balance</SubmitButton>
      </form>
    </Card>
  );
}

export function SubtractBalanceForm({
  action,
  contactId,
  contactAccountName,
  accounts,
}: {
  action: (prev: BalanceFormState, formData: FormData) => Promise<BalanceFormState>;
  contactId: number;
  contactAccountName: string;
  accounts: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <Card title="Subtract Balance">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="contact_id" value={contactId} />
        <FormAlert message={state.error} />
        <FormAlert message={state.success} variant="success" />

        <div className="grid gap-5 md:grid-cols-3">
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            error={state.fieldErrors?.date}
          />
          <FormInput
            label="Subtraction Balance From"
            name="contact_account_name"
            defaultValue={contactAccountName}
            readOnly
          />
          <FormSelect
            label="Account"
            name="account_id"
            required
            placeholder="Select one"
            options={accounts}
            error={state.fieldErrors?.account_id}
          />
          <FormInput
            label="Amount"
            name="sub_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            error={state.fieldErrors?.sub_amount}
          />
          <FormInput label="Narration" name="narration" />
        </div>

        <SubmitButton>Subtract Balance</SubmitButton>
      </form>
    </Card>
  );
}
