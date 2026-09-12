// Department - port of the matching Setup/Location controller.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { departmentRepository } from '@/lib/product/repositories';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { saveDepartment, deleteDepartment } from '../../setup/actions';

export const metadata: Metadata = { title: 'Department' };

export default async function DepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('departments.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await departmentRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('departments.store'),
    can('departments.edit'),
    can('departments.delete'),
  ]);

  return (
    <>
      <PageHeader title="Department" breadcrumb={[{ label: 'Human Resource' }, { label: 'Department' }]} />
      <ReferenceCrud
        title="Departments"
        singular="Department"
        extraColumns={[]}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.details,
          status: r.status,
          extra: undefined,
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['departments.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={true}
        hasStatus={true}
        saveAction={saveDepartment}
        deleteAction={deleteDepartment}

      />
    </>
  );
}
