'use client';

// The "Opening Balance Add" modal of `inventory::showroom.show`.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeShowroomOpeningBalance, type OpeningBalanceState } from './actions';

const INITIAL: OpeningBalanceState = {};

export function ShowroomOpeningBalanceForm({ showroomId }: { showroomId: number }) {
  const [state, formAction] = useActionState(storeShowroomOpeningBalance, INITIAL);

  return (
    <Card title="Opening Balance Add">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="showroom_id" value={showroomId} />
        <input type="hidden" name="type" value="showroom" />
        <FormAlert message={state.error} />
        <FormAlert message={state.success} variant="success" />

        <FormInput
          label="Opening Balance"
          name="opening_balance"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
          error={state.fieldErrors?.opening_balance}
        />

        <SubmitButton>Save</SubmitButton>
      </form>
    </Card>
  );
}
