// Leave types - port of LeaveTypeController.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { leaveTypeRepository } from '@/lib/hr/leave';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { deleteLeaveType, saveLeaveType } from '../actions';

export const metadata: Metadata = { title: 'Leave Type' };

export default async function LeaveTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('leave_types.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await leaveTypeRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('leave_types.store'),
    can('leave_types.edit'),
    can('leave_types.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Leave Type"
        breadcrumb={[{ label: 'Leave' }, { label: 'Leave Type' }]}
      />
      <ReferenceCrud
        title="Leave Types"
        singular="Leave Type"
        rows={rows.map((r) => ({ id: r.id, name: r.name, status: r.status }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['leave_types.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={false}
        saveAction={saveLeaveType}
        deleteAction={deleteLeaveType}
      />
    </>
  );
}
