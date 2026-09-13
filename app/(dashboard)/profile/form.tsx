'use client';

// `contact::contact.my_details.profile`

import { useActionState } from 'react';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  FormActions,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { updateContactProfile, type ContactProfileState } from './actions';

const EMPTY: ContactProfileState = {};

export function ContactProfileForm({
  contact,
  countries,
}: {
  contact: {
    name: string;
    email: string;
    mobile: string;
    taxNumber: string;
    countryId: string;
    state: string;
    city: string;
    address: string;
    note: string;
  };
  countries: SelectOption[];
}) {
  const [state, action] = useActionState(updateContactProfile, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput
          label="Name"
          name="name"
          defaultValue={contact.name}
          required
          error={state.fieldErrors?.name}
        />
        <FormInput label="Email" name="email" type="email" defaultValue={contact.email} />
        <FormInput label="Mobile" name="mobile" defaultValue={contact.mobile} />
        <FormInput label="Tax Number" name="tax_number" defaultValue={contact.taxNumber} />
        <FormSelect
          label="Country"
          name="country_id"
          defaultValue={contact.countryId}
          options={countries}
          placeholder="Select country"
        />
        <FormInput label="State" name="state" defaultValue={contact.state} />
        <FormInput label="City" name="city" defaultValue={contact.city} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Avatar
          </label>
          <input
            type="file"
            name="file"
            accept="image/*"
            className="block w-full text-xs text-muted-foreground file:me-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
          />
        </div>
      </div>

      <FormInput label="Address" name="address" defaultValue={contact.address} />
      <FormTextarea label="Note" name="note" rows={3} defaultValue={contact.note} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput
          label="New Password"
          name="password"
          type="password"
          hint="Leave blank to keep the current password"
          error={state.fieldErrors?.password}
        />
        <FormInput
          label="Confirm Password"
          name="password_confirmation"
          type="password"
          error={state.fieldErrors?.password_confirmation}
        />
      </div>

      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </form>
  );
}
