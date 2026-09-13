// Apply leave - port of LeaveController@index (`apply_leave.index`).
//
// A staff member sees their own applications; approvers see everyone's.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { activeUserOptions } from '@/lib/hr/staff';
import {
  LeaveStatus,
  leaveBalance,
  leaveTypeRepository,
  listLeaveApplications,
  findLeaveApplication,
} from '@/lib/hr/leave';
import { dateConvert } from '@/lib/settings';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Hourglass, CircleCheck, CircleX, CalendarDays } from 'lucide-react';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { deleteLeaveApplicationAction } from './actions';
import { ApplyLeaveForm } from './apply-leave-form';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Apply Leave' };

export default async function ApplyLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; edit?: string }>;
}) {
  const user = await authorize('apply_leave.index');
  const sp = await searchParams;

  // Approvers see every application; everyone else sees only their own.
  const canApprove = await can('set_approval_leave');

  const [{ rows, total, page, perPage }, types, balance, staffUsers, editing] = await Promise.all([
    listLeaveApplications({
      userId: canApprove ? undefined : user.id,
      page: Number(sp.page ?? 1),
    }),
    leaveTypeRepository.all(),
    leaveBalance(user.id),
    user.isSystemUser ? activeUserOptions() : Promise.resolve([]),
    // `apply_leave.edit` - amending an application that has not been decided.
    sp.edit ? findLeaveApplication(Number(sp.edit)) : Promise.resolve(null),
  ]);

  const leaveRows = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      startLabel: await dateConvert(r.leave.startDate),
      endLabel: r.leave.endDate ? await dateConvert(r.leave.endDate) : '-',
    })),
  );

  // The form on the left is about one person's balance; the counters answer the
  // approver's question - what is still sitting in the queue.
  const pendingCount = leaveRows.filter((r) => r.leave.status === LeaveStatus.Pending).length;
  const approvedCount = leaveRows.filter((r) => r.leave.status === LeaveStatus.Approved).length;
  const rejectedCount = leaveRows.filter((r) => r.leave.status === LeaveStatus.Rejected).length;

  return (
    <>
      <PageHeader
        title="Apply Leave"
        breadcrumb={[{ label: 'Leave' }, { label: 'Apply Leave' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Pending', value: pendingCount, detail: 'Awaiting a decision', icon: Hourglass },
          { label: 'Approved', value: approvedCount, detail: 'On this page', icon: CircleCheck },
          { label: 'Rejected', value: rejectedCount, detail: 'On this page', icon: CircleX },
          { label: 'Applications', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: CalendarDays },
        ]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-4">
          <ApplyLeaveForm
            leaveTypes={types.map((t) => ({ value: t.id, label: t.name }))}
            balance={balance}
            users={
              user.isSystemUser
                ? staffUsers.map((u) => ({ value: u.id, label: u.name }))
                : undefined
            }
            currentUserId={user.id}
            editing={
              editing
                ? {
                    id: editing.leave.id,
                    leaveTypeId: editing.leave.leaveTypeId,
                    day: editing.leave.day,
                    applyDate: editing.leave.applyDate,
                    startDate: editing.leave.startDate,
                    endDate: editing.leave.endDate,
                    reason: editing.leave.reason,
                    makeupLeave: editing.leave.makeupLeave,
                    makeupDate: editing.leave.makeupDate,
                    makeupHalf: editing.leave.makeupHalf,
                  }
                : null
            }
          />
        </div>

        <div className="col-span-12 xl:col-span-8">
          <Card title={`Applications (${total})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Staff' },
                { label: 'Type' },
                { label: 'From' },
                { label: 'To' },
                { label: 'Days' },
                { label: 'Status' },
                { label: '' },
              ]}
              isEmpty={leaveRows.length === 0}
              empty="No leave applications yet."
            >
              {leaveRows.map((row) => (
                <Tr key={row.leave.id}>
                  <Td className="font-medium text-foreground">
                    {row.userName ?? '-'}
                  </Td>
                  <Td>{row.leaveTypeName ?? '-'}</Td>
                  <Td>{row.startLabel}</Td>
                  <Td>{row.endLabel}</Td>
                  <Td>{row.leave.totalDays}</Td>
                  <Td>
                    <Badge
                      size="sm"
                      color={
                        row.leave.status === LeaveStatus.Approved
                          ? 'success'
                          : row.leave.status === LeaveStatus.Rejected
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {row.leave.status === LeaveStatus.Approved
                        ? 'Approved'
                        : row.leave.status === LeaveStatus.Rejected
                          ? 'Rejected'
                          : 'Pending'}
                    </Badge>
                  </Td>
                  <Td>
                    {row.leave.status === LeaveStatus.Pending ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`${ROUTES['apply_leave.index']}?edit=${row.leave.id}`}
                          className="text-primary hover:text-primary text-xs font-medium"
                        >
                          <Phrase>Edit</Phrase>
                        </Link>
                        <form action={deleteLeaveApplicationAction}>
                          <input type="hidden" name="id" value={row.leave.id} />
                          <ActionButton confirm="Withdraw this application?">
                            Withdraw
                          </ActionButton>
                        </form>
                      </div>
                    ) : (
                      '-'
                    )}
                  </Td>
                </Tr>
              ))}
            </DataTable>

            <Pagination
              page={page}
              perPage={perPage}
              total={total}
              baseUrl={ROUTES['apply_leave.index']}
              params={sp}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
