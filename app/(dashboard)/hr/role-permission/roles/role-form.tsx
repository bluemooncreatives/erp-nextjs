'use client';

// Role form - port of `rolepermission::role.create`.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { saveRole, type HrFormState } from '../../actions';

const INITIAL: HrFormState = {};

export function RoleForm() {
  const [state, formAction] = useActionState(saveRole, INITIAL);

  return (
    <Card title="Add Role">
      <form action={formAction} className="space-y-4">
        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormInput
          label="Role Name"
          name="name"
          required
          error={state.fieldErrors?.name}
        />

        <FormSelect
          label="Role Type"
          name="type"
          defaultValue="regular_user"
          options={[
            { value: 'system_user', label: 'System user (full access)' },
            { value: 'regular_user', label: 'Regular user (branch staff)' },
            { value: 'normal_user', label: 'Normal user (customer / supplier)' },
          ]}
          hint="System users bypass every permission check."
        />

        <FormInput label="Details" name="details" />

        <SubmitButton>Save Role</SubmitButton>
      </form>
    </Card>
  );
}
