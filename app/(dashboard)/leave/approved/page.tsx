// Approved leave - port of LeaveController@approved_index.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { LeaveStatus } from '@/lib/hr/leave';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { LeaveApprovalList } from '../approval-list';

export const metadata: Metadata = { title: 'Approve Leave Request' };

export default async function ApprovedLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await authorize('approved_index');
  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="Approve Leave Request"
        breadcrumb={[{ label: 'Leave' }, { label: 'Approved' }]}
      />
      <LeaveApprovalList
        status={LeaveStatus.Approved}
        title="Approved leave"
        baseUrl={ROUTES['approved_index']}
        page={Number(sp.page ?? 1)}
        searchParams={sp}
      />
    </>
  );
}
