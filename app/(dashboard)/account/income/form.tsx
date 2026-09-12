'use client';
import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect, FormTextarea, type SelectOption } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeIncome, updateIncomeAction } from '../actions';
export function IncomeForm({ accounts, defaults }: { accounts: SelectOption[]; defaults?: { id: number; accountId: number; amount: number; date: string; narration: string | null; note: string | null } }) {
  const [state, action] = useActionState(defaults ? updateIncomeAction : storeIncome, {});
  return <Card title={defaults ? 'Edit Income' : 'Add Income'}><form action={action} className="max-w-xl space-y-5">
    {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}
    <FormAlert variant="error" message={state.error} />
    <FormSelect label="Account" name="account_id" required options={accounts} placeholder="Select account" defaultValue={defaults?.accountId} error={state.fieldErrors?.account_id} />
    <FormInput label="Amount" name="amount" type="number" step="0.01" min="0.01" required defaultValue={defaults?.amount} error={state.fieldErrors?.amount} />
    <FormInput label="Date" name="date" type="date" required defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)} error={state.fieldErrors?.date} />
    <FormTextarea label="Narration" name="narration" defaultValue={defaults?.narration ?? ''} />
    <FormInput label="Transaction Note" name="note" defaultValue={defaults?.note ?? ''} />
    <SubmitButton>{defaults ? 'Update Income' : 'Save Income'}</SubmitButton>
  </form></Card>;
}
