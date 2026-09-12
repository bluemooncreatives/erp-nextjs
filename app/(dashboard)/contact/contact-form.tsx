'use client';

// Contact form - port of contact::contact.create / contact.edit.
//
// The password fields only appear when `general_settings.contact_login` is on,
// matching the Blade view's `@if(app('general_setting')->contact_login)`.

import Link from 'next/link';
import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { ROUTES } from '@/lib/routes';
import type { ContactFormState } from './actions';

const INITIAL: ContactFormState = {};

export type ContactFormDefaults = {
  id?: number;
  contactType?: string;
  name?: string;
  businessName?: string | null;
  taxNumber?: string | null;
  openingBalance?: string | null;
  payTerm?: string | null;
  payTermCondition?: string | null;
  customerGroup?: string | null;
  creditLimit?: string | null;
  email?: string | null;
  username?: string | null;
  mobile?: string | null;
  alternateContactNo?: string | null;
  countryId?: number | null;
  state?: string | null;
  city?: string | null;
  note?: string | null;
  address?: string | null;
  avatar?: string | null;
};

export function ContactForm({
  action,
  defaults = {},
  countries,
  contactLoginEnabled,
  heading,
  lockType,
}: {
  action: (
    prev: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
  defaults?: ContactFormDefaults;
  countries: SelectOption[];
  contactLoginEnabled: boolean;
  heading: string;
  /** Pre-selects and locks the type when adding from the Customer/Supplier list. */
  lockType?: 'Customer' | 'Supplier';
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const isEdit = defaults.id != null;

  return (
    <form action={formAction} className="space-y-6">
      {isEdit ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormAlert variant="error" message={state.error} />

      <Card title={heading}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {lockType ? (
            <input type="hidden" name="contact_type" value={lockType} />
          ) : (
            <FormSelect
              label="Contact Type"
              name="contact_type"
              required
              defaultValue={defaults.contactType ?? 'Customer'}
              options={[
                { value: 'Customer', label: 'Customer' },
                { value: 'Supplier', label: 'Supplier' },
              ]}
              error={state.fieldErrors?.contact_type}
            />
          )}

          <FormInput
            label="Name"
            name="name"
            required
            defaultValue={defaults.name ?? ''}
            error={state.fieldErrors?.name}
          />

          <FormInput
            label="Business Name"
            name="business_name"
            defaultValue={defaults.businessName ?? ''}
          />

          <FormInput
            label="Email"
            name="email"
            type="email"
            defaultValue={defaults.email ?? ''}
            error={state.fieldErrors?.email}
          />

          <FormInput
            label="Mobile"
            name="mobile"
            defaultValue={defaults.mobile ?? ''}
          />

          <FormInput
            label="Alternate Contact No"
            name="alternate_contact_no"
            defaultValue={defaults.alternateContactNo ?? ''}
          />

          <FormInput
            label="Tax Number"
            name="tax_number"
            defaultValue={defaults.taxNumber ?? ''}
          />

          <FormInput
            label="Opening Balance"
            name="opening_balance"
            type="number"
            step="0.01"
            defaultValue={defaults.openingBalance ?? '0'}
            hint={isEdit ? 'Changing this does not re-post the opening entries.' : undefined}
          />

          <FormInput
            label="Credit Limit"
            name="credit_limit"
            type="number"
            step="0.01"
            defaultValue={defaults.creditLimit ?? ''}
          />

          <FormInput
            label="Pay Term"
            name="pay_term"
            defaultValue={defaults.payTerm ?? ''}
          />

          <FormSelect
            label="Pay Term Condition"
            name="pay_term_condition"
            defaultValue={defaults.payTermCondition ?? ''}
            placeholder="Select"
            options={[
              { value: 'days', label: 'Days' },
              { value: 'months', label: 'Months' },
            ]}
          />

          <FormInput
            label="Customer Group"
            name="customer_group"
            defaultValue={defaults.customerGroup ?? ''}
          />
        </div>
      </Card>

      <Card title="Address">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FormSelect
            label="Country"
            name="country_id"
            placeholder="Select country"
            defaultValue={defaults.countryId != null ? String(defaults.countryId) : ''}
            options={countries}
          />
          <FormInput label="State" name="state" defaultValue={defaults.state ?? ''} />
          <FormInput label="City" name="city" defaultValue={defaults.city ?? ''} />
          <FormTextarea
            label="Address"
            name="address"
            defaultValue={defaults.address ?? ''}
            wrapperClassName="md:col-span-2 lg:col-span-3"
          />
          <FormTextarea
            label="Note"
            name="note"
            defaultValue={defaults.note ?? ''}
            wrapperClassName="md:col-span-2 lg:col-span-3"
          />
        </div>
      </Card>

      <Card title="Profile">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FormInput
            label="Avatar"
            name="file"
            type="file"
            accept="image/*"
            hint={defaults.avatar ? 'Leave empty to keep the current image.' : undefined}
          />

          {contactLoginEnabled ? (
            <>
              <FormInput
                label="Username"
                name="username"
                defaultValue={defaults.username ?? ''}
              />
              <FormInput
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!isEdit}
                error={state.fieldErrors?.password}
                hint={isEdit ? 'Leave empty to keep the current password.' : undefined}
              />
            </>
          ) : null}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['add_contact.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton>{isEdit ? 'Update Contact' : 'Save Contact'}</SubmitButton>
      </div>
    </form>
  );
}
