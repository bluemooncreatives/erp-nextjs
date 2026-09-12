'use client';

// The category form's extra inputs - parent category and code.

import { FormInput, FormSelect } from '@/components/erp/fields';

export function CategoryExtraFields({
  parents,
  defaultParentId,
  defaultCode,
}: {
  parents: Array<{ value: number; label: string }>;
  defaultParentId: number | null;
  defaultCode: string;
}) {
  return (
    <>
      <FormSelect
        label="Parent Category"
        name="parent_id"
        placeholder="None (top level)"
        defaultValue={defaultParentId != null ? String(defaultParentId) : ''}
        options={parents}
      />
      <FormInput label="Code" name="code" defaultValue={defaultCode} />
    </>
  );
}
