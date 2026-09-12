// Pending leave - port of LeaveController@pending_index.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { LeaveStatus } from '@/lib/hr/leave';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { LeaveApprovalList } from '../approval-list';

export const metadata: Metadata = { title: 'Pending Leave' };

export default async function PendingLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await authorize('pending_index');
  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="Pending Leave"
        breadcrumb={[{ label: 'Leave' }, { label: 'Pending' }]}
      />
      <LeaveApprovalList
        status={LeaveStatus.Pending}
        title="Pending leave"
        baseUrl={ROUTES['pending_index']}
        page={Number(sp.page ?? 1)}
        searchParams={sp}
      />
    </>
  );
}
