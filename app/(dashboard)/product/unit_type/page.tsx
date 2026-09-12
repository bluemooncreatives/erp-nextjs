// Port of Modules/Product/Http/Controllers/UnitTypeController.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { unitTypeRepository } from '@/lib/product/repositories';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { ROUTES } from '@/lib/routes';
import { deleteUnitType, saveUnitType } from '../actions';

export const metadata: Metadata = { title: 'Unit Type' };

export default async function UnitTypePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('unit_type.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await unitTypeRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('unit_type.store'),
    can('unit_type.edit'),
    can('unit_type.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Unit Type"
        breadcrumb={[{ label: 'Products' }, { label: 'Unit Type' }]}
      />
      <ReferenceCrud
        title="Unit Types"
        singular="Unit Type"
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['unit_type.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={saveUnitType}
        deleteAction={deleteUnitType}
      />
    </>
  );
}
