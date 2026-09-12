// Warehouse - port of the matching Setup/Location controller.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { wareHouseRepository } from '@/lib/setup/repositories';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { saveWareHouse, deleteWareHouse } from '../../setup/actions';
import { ContactFields } from './fields';

export const metadata: Metadata = { title: 'Warehouse' };

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('warehouse.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await wareHouseRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('warehouse.store'),
    can('warehouse.edit'),
    can('warehouse.destroy'),
  ]);

  return (
    <>
      <PageHeader title="Warehouse" breadcrumb={[{ label: 'Location' }, { label: 'Warehouse' }]} />
      <ReferenceCrud
        title="Warehouses"
        singular="Warehouse"
        extraColumns={['Email', 'Phone']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: null,
          status: r.status,
          extra: [r.email ?? '-', r.phone ?? '-'],
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['warehouse.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={false}
        hasStatus={true}
        saveAction={saveWareHouse}
        deleteAction={deleteWareHouse}
      extraFields={() => <ContactFields />}
      />
    </>
  );
}
