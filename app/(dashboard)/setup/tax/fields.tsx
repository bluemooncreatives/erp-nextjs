'use client';

import { FormInput } from '@/components/erp/fields';

export function RateField({ defaultRate }: { defaultRate: number }) {
  return (
    <FormInput
      label="Rate (%)"
      name="rate"
      type="number"
      step="0.01"
      min="0"
      defaultValue={String(defaultRate)}
    />
  );
}
