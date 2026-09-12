'use client';

import { FormInput } from '@/components/erp/fields';

export function CountryFields() {
  return (
    <>
      <FormInput label="ISO2" name="iso2" maxLength={10} />
      <FormInput label="ISO3" name="iso3" maxLength={10} />
      <FormInput label="Phone Code" name="phonecode" />
      <FormInput label="Currency" name="currency" />
      <FormInput label="Capital" name="capital" />
    </>
  );
}
