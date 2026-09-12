'use client';

// Holiday form - port of `attendance::holidays.create`.

import { useActionState, useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeHoliday, type LeaveFormState } from '../../leave/actions';

const INITIAL: LeaveFormState = {};

export function HolidayForm() {
  const [state, formAction] = useActionState(storeHoliday, INITIAL);
  const [type, setType] = useState('0');

  return (
    <Card title="Add Holiday">
      <form action={formAction} className="space-y-4">
        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormInput
          label="Name"
          name="name"
          required
          error={state.fieldErrors?.name}
        />

        <FormSelect
          label="Type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[
            { value: '0', label: 'Single day' },
            { value: '1', label: 'Date range' },
          ]}
        />

        <FormInput
          label={type === '1' ? 'From' : 'Date'}
          name="date"
          type="date"
          required
          error={state.fieldErrors?.date}
        />

        {type === '1' ? (
          <FormInput label="To" name="end_date" type="date" required />
        ) : null}

        <SubmitButton>Save Holiday</SubmitButton>
      </form>
    </Card>
  );
}
