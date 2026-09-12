// Port of Modules/Product/Http/Controllers/UnitTypeController.

import type { Metadata } from 'next';
import Link from 'next/link';
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
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={ROUTES['unit_type.csv_download']}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 ring-1 ring-inset ring-gray-300 hover:bg-gray-100 dark:ring-gray-700 dark:hover:bg-white/5"
            >
              Download CSV
            </a>
            <Link
              href={ROUTES['unit_type.csv_upload']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Upload via CSV
            </Link>
          </div>
        }
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
