'use client';

// Branch contact details - the extra inputs on the Branch form.

import { FormInput } from '@/components/erp/fields';

export function ContactFields() {
  return (
    <>
      <FormInput label="Email" name="email" type="email" />
      <FormInput label="Phone" name="phone" />
      <FormInput label="Address" name="address" />
    </>
  );
}
