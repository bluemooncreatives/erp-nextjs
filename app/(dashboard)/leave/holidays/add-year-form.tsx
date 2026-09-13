'use client';

// The "Add New Year" modal from `leave::holiday_setup.index`, inline here.

import { useActionState } from 'react';
import { Plus } from 'lucide-react';
import { FormInput } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { addHolidayYear, type HolidayFormState } from './actions';
import { Phrase } from '@/context/TranslationContext';

const INITIAL: HolidayFormState = {};

export function AddYearForm() {
  const [state, formAction] = useActionState(addHolidayYear, INITIAL);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <FormInput
        type="number"
        name="year"
        label="Add New Year"
        min="1900"
        max="2999"
        placeholder={String(new Date().getUTCFullYear() + 1)}
        error={state.fieldErrors?.year ?? state.error}
        wrapperClassName="w-28"
      />
      <SubmitButton size="sm" pendingLabel="Adding...">
        <Plus className="size-3.5" />
        <Phrase>Add</Phrase>
      </SubmitButton>
    </form>
  );
}
