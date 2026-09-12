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

const INITIAL: AccountFormState = {};

export function ChartAccountForm({ parents }: { parents: SelectOption[] }) {
  const [state, formAction] = useActionState(saveChartAccount, INITIAL);

  return (
    <Card title="Add Account">
      <form action={formAction} className="space-y-4">
        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormInput
          label="Account Name"
          name="name"
          required
          error={state.fieldErrors?.name}
        />

        <FormSelect
          label="Account Type"
          name="type"
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
          placeholder="None (top level)"
          options={parents}
        />

        <FormSelect
          label="Configuration Group"
          name="configuration_group_id"
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

        <FormTextarea label="Description" name="description" />

        <FormCheckbox label="This is a group (heading) account" name="is_group" value="1" />

        <FormSelect
          label="Status"
          name="status"
          defaultValue="1"
          options={[
            { value: 1, label: 'Active' },
            { value: 0, label: 'Inactive' },
          ]}
        />

        <SubmitButton>Save Account</SubmitButton>
      </form>
    </Card>
  );
}
