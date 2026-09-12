// Port of Modules/Product/Http/Controllers/VariantController.
//
// A variant (e.g. "Colour") owns a list of values (e.g. "Red, Blue"). Values
// already attached to a product variation carry `used = 1` and are protected
// from deletion, as VariantRepository did.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { allVariantsWithValues, variantRepository } from '@/lib/product/repositories';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { ROUTES } from '@/lib/routes';
import { deleteVariant, saveVariant } from '../actions';
import { VariantValuesField } from './values-field';

export const metadata: Metadata = { title: 'Variant' };

export default async function VariantPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('variant.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await variantRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const withValues = await allVariantsWithValues();
  const valuesById = new Map(
    withValues.map((v) => [v.id, v.values.map((x) => x.value)]),
  );

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('variant.store'),
    can('variant.edit'),
    can('variant.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Variant"
        breadcrumb={[{ label: 'Products' }, { label: 'Variant' }]}
      />
      <ReferenceCrud
        title="Variants"
        singular="Variant"
        extraColumns={['Values']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
          extra: [(valuesById.get(r.id) ?? []).join(', ') || '-'],
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['variant.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={saveVariant}
        deleteAction={deleteVariant}
        extraFields={(row) => (
          <VariantValuesField
            defaultValues={row ? (valuesById.get(row.id) ?? []).join(', ') : ''}
          />
        )}
      />
    </>
  );
}
