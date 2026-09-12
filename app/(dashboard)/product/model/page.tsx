import { LinkButton } from '@/components/common/link-button';
// Port of Modules/Product/Http/Controllers/ModelController.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { modelRepository } from '@/lib/product/repositories';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { ROUTES } from '@/lib/routes';
import { deleteModel, saveModel } from '../actions';

export const metadata: Metadata = { title: 'Model' };

export default async function ModelPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('model.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await modelRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('model.store'),
    can('model.edit'),
    can('model.delete'),
  ]);

  return (
    <>
      <PageHeader title="Model" breadcrumb={[{ label: 'Products' }, { label: 'Model' }]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={ROUTES['model.csv_download']}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted"
            >
              Download CSV
            </a>
            <LinkButton
              href={ROUTES['model.csv_upload']}
              
            >
              Upload via CSV
            </LinkButton>
          </div>
        }
      />
      <ReferenceCrud
        title="Models"
        singular="Model"
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['model.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={saveModel}
        deleteAction={deleteModel}
      />
    </>
  );
}
