'use client';

// Leave define form - port of `leave::leave_defines.create`.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormCheckbox,
  FormInput,
  FormSelect,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeLeaveDefine, type LeaveFormState } from '../actions';

const INITIAL: LeaveFormState = {};

export function LeaveDefineForm({
  roles,
  leaveTypes,
}: {
  roles: SelectOption[];
  leaveTypes: SelectOption[];
}) {
  const [state, formAction] = useActionState(storeLeaveDefine, INITIAL);

  return (
    <Card title="Define Leave">
      <form action={formAction} className="space-y-4">
        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormSelect
          label="Role"
          name="role_id"
          required
          placeholder="Select role"
          options={roles}
          error={state.fieldErrors?.role_id}
        />

        <FormSelect
          label="Leave Type"
          name="leave_type_id"
          required
          placeholder="Select leave type"
          options={leaveTypes}
          error={state.fieldErrors?.leave_type_id}
        />

        <FormInput
          label="Total Days"
          name="total_days"
          type="number"
          min="0"
          step="0.5"
          required
          error={state.fieldErrors?.total_days}
        />

        <FormInput
          label="Max Carry Forward"
          name="max_forward"
          type="number"
          min="0"
          defaultValue="0"
        />

        <FormCheckbox
          label="Allow carrying the balance forward"
          name="balance_forward"
          value="1"
        />

        <FormInput
          label="Year"
          name="year"
          type="number"
          min="2000"
          max="2100"
          defaultValue={String(new Date().getUTCFullYear())}
        />

        <SubmitButton>Save Definition</SubmitButton>
      </form>
    </Card>
  );
}
