// Tax - port of the matching Setup/Location controller.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { taxRepository } from '@/lib/product/repositories';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { saveTax, deleteTax } from '../actions';

export const metadata: Metadata = { title: 'Tax' };

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('tax.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await taxRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('tax.store'),
    can('tax.edit'),
    can('tax.destroy'),
  ]);

  const rateById = new Map(rows.map((r) => [r.id, r.rate]));

  return (
    <>
      <PageHeader title="Tax" breadcrumb={[{ label: 'Setup' }, { label: 'Tax' }]} />
      <ReferenceCrud
        title="Taxes"
        singular="Tax"
        extraColumns={['Rate (%)']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
          extra: [r.rate],
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['tax.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={true}
        hasStatus={true}
        saveAction={saveTax}
        deleteAction={deleteTax}
        extraFields={[
          {
            name: 'rate',
            label: 'Rate (%)',
            kind: 'number',
            step: '0.01',
            min: '0',
            defaultValue: '0',
            values: Object.fromEntries(
              rows.map((r) => [String(r.id), String(rateById.get(r.id) ?? 0)]),
            ),
          },
        ]}
      />
    </>
  );
}
