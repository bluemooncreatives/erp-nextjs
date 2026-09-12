// Shared approval list used by the Approve and Pending leave screens
// (`leave::apply_approvals.approval_list` / `pending_list`).

import { can } from '@/lib/auth/permissions';
import { LeaveStatus, listLeaveApplications } from '@/lib/hr/leave';
import { dateConvert } from '@/lib/settings';
import { Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { setLeaveApprovalAction } from './actions';

export async function LeaveApprovalList({
  status,
  title,
  baseUrl,
  page,
  searchParams,
}: {
  status: number;
  title: string;
  baseUrl: string;
  page: number;
  searchParams: Record<string, string | undefined>;
}) {
  const result = await listLeaveApplications({ status, page });
  const canApprove = await can('set_approval_leave');

  const rows = await Promise.all(
    result.rows.map(async (r) => ({
      ...r,
      startLabel: await dateConvert(r.leave.startDate),
      endLabel: r.leave.endDate ? await dateConvert(r.leave.endDate) : '-',
      applyLabel: await dateConvert(r.leave.applyDate),
    })),
  );

  return (
    <Card title={`${title} (${result.total})`} bodyClassName="">
      <DataTable
        columns={[
          { label: 'Staff' },
          { label: 'Type' },
          { label: 'Applied' },
          { label: 'From' },
          { label: 'To' },
          { label: 'Days' },
          { label: 'Reason' },
          { label: 'Status' },
          ...(canApprove && status === LeaveStatus.Pending ? [{ label: 'Action' }] : []),
        ]}
        isEmpty={rows.length === 0}
        empty={`No ${title.toLowerCase()}.`}
      >
        {rows.map((row) => (
          <Tr key={row.leave.id}>
            <Td className="font-medium text-gray-700 dark:text-gray-300">
              {row.userName ?? '-'}
            </Td>
            <Td>{row.leaveTypeName ?? '-'}</Td>
            <Td>{row.applyLabel}</Td>
            <Td>{row.startLabel}</Td>
            <Td>{row.endLabel}</Td>
            <Td>{row.leave.totalDays}</Td>
            <Td className="max-w-xs truncate">{row.leave.reason}</Td>
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
            {canApprove && status === LeaveStatus.Pending ? (
              <Td>
                <div className="flex items-center gap-2">
                  <form action={setLeaveApprovalAction}>
                    <input type="hidden" name="id" value={row.leave.id} />
                    <input type="hidden" name="status" value={LeaveStatus.Approved} />
                    <ActionButton variant="primary">Approve</ActionButton>
                  </form>
                  <form action={setLeaveApprovalAction}>
                    <input type="hidden" name="id" value={row.leave.id} />
                    <input type="hidden" name="status" value={LeaveStatus.Rejected} />
                    <ActionButton confirm="Reject this application?">Reject</ActionButton>
                  </form>
                </div>
              </Td>
            ) : null}
          </Tr>
        ))}
      </DataTable>

      <Pagination
        page={result.page}
        perPage={result.perPage}
        total={result.total}
        baseUrl={baseUrl}
        params={searchParams}
      />
    </Card>
  );
}
