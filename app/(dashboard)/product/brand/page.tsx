// Port of Modules/Product/Http/Controllers/BrandController (index/create/store/
// edit/update/delete) and product::brand.brand.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { brandRepository } from '@/lib/product/repositories';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { ROUTES } from '@/lib/routes';
import { deleteBrand, saveBrand } from '../actions';

export const metadata: Metadata = { title: 'Brand' };

export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('brand.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await brandRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('brand.store'),
    can('brand.edit'),
    can('brand.delete'),
  ]);

  return (
    <>
      <PageHeader title="Brand" breadcrumb={[{ label: 'Products' }, { label: 'Brand' }]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={ROUTES['brand.csv_download']}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted"
            >
              Download CSV
            </a>
            <Link
              href={ROUTES['brand.csv_upload']}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
            >
              Upload via CSV
            </Link>
          </div>
        }
      />
      <ReferenceCrud
        title="Brands"
        singular="Brand"
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['brand.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={saveBrand}
        deleteAction={deleteBrand}
      />
    </>
  );
}
