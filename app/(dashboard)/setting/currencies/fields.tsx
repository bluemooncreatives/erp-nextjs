'use client';

import { FormInput } from '@/components/erp/fields';

export function CurrencyFields({
  defaultCode,
  defaultSymbol,
}: {
  defaultCode: string;
  defaultSymbol: string;
}) {
  return (
    <>
      <FormInput label="Code" name="code" required defaultValue={defaultCode} />
      <FormInput label="Symbol" name="symbol" defaultValue={defaultSymbol} />
    </>
  );
}
