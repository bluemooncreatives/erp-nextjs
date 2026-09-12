'use client';

// Chart-of-accounts form - port of `account::chart_account.create`.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormCheckbox,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { saveChartAccount, type AccountFormState } from './actions';
import type { ChartAccountsRow } from '@/lib/db/schema';

const INITIAL: AccountFormState = {};

export function ChartAccountForm({ parents, account }: { parents: SelectOption[]; account?: ChartAccountsRow }) {
  const [state, formAction] = useActionState(saveChartAccount, INITIAL);

  return (
    <Card title={account ? 'Edit Account' : 'Add Account'}>
      <form action={formAction} className="space-y-4">
        {account ? <input type="hidden" name="id" value={account.id} /> : null}
        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormInput
          label="Account Name"
          name="name"
          defaultValue={account?.name ?? ''}
          required
          error={state.fieldErrors?.name}
        />

        <FormSelect
          label="Account Type"
          name="type"
          defaultValue={account?.type ?? ''}
          required
          placeholder="Select type"
          options={[
            { value: 1, label: 'Asset' },
            { value: 2, label: 'Liability' },
            { value: 3, label: 'Expense' },
            { value: 4, label: 'Income' },
            { value: 5, label: 'Equity' },
          ]}
          error={state.fieldErrors?.type}
        />

        <FormSelect
          label="Parent Account"
          name="parent_id"
          defaultValue={account?.parentId ?? ''}
          error={state.fieldErrors?.parent_id}
          placeholder="None (top level)"
          options={parents}
        />

        <FormSelect
          label="Configuration Group"
          name="configuration_group_id"
          defaultValue={account?.configurationGroupId ?? ''}
          placeholder="None"
          options={[
            { value: 1, label: 'Cash' },
            { value: 2, label: 'Bank' },
            { value: 3, label: 'Receivable' },
            { value: 4, label: 'Payable' },
            { value: 5, label: 'Equity' },
          ]}
          hint="Cash and Bank accounts appear in the payment pickers."
        />

        <FormTextarea label="Description" name="description" defaultValue={account?.description ?? ''} />

        <FormCheckbox label="This is a group (heading) account" name="is_group" value="1" defaultChecked={account?.isGroup === 1} />

        <FormSelect
          label="Status"
          name="status"
          defaultValue={account?.status ?? 1}
          options={[
            { value: 1, label: 'Active' },
            { value: 0, label: 'Inactive' },
          ]}
        />

        <SubmitButton>{account ? 'Update Account' : 'Save Account'}</SubmitButton>
      </form>
    </Card>
  );
}
