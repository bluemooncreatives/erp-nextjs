'use client';

// The variant form's values input - a comma-separated list, matching the
// repeater the Blade form posted as `values[]`.

import { FormInput } from '@/components/erp/fields';

export function VariantValuesField({ defaultValues }: { defaultValues: string }) {
  return (
    <FormInput
      label="Values"
      name="values"
      defaultValue={defaultValues}
      placeholder="Red, Blue, Green"
      hint="Separate each value with a comma. Values already used by a product are kept."
    />
  );
}
