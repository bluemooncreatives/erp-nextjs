// `approve.leave.department` / `search.leave.department` -
// LeaveController@departmentWiseApprove and @departmentWiseSearch,
// `leave::apply_approvals.dept_wise_list`.
//
// Both controller methods render the same Blade; the second adds the results.
// That is one screen with query parameters here.
//
// The search leg is broken in the source: `departmentWiseSearch` calls
// `$this->userRepository->deptStaffs()`, which `app/Repositories/UserRepository`
// does not define, so submitting the form 500s. Reproducing a crash would not
// serve anyone, so the staff list is built here the way the Blade expected -
// the active staff of the chosen department.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listLeaveApplications } from '@/lib/hr/leave';
import { listStaff } from '@/lib/hr/staff';
import { departmentRepository } from '@/lib/product/repositories';
import { dateConvert } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { FormSelect } from '@/components/erp/fields';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/common/link-button';
import { Filter, X } from 'lucide-react';
import { Badge } from '@/components/erp/badge';
import { ReportSummary } from '@/components/erp/report-summary';
import { Building2, CalendarCheck, CalendarClock, Users } from 'lucide-react';
import { ActionButton } from '@/components/erp/submit-button';
import { deleteLeaveApplicationAction } from '../actions';

export const metadata: Metadata = { title: 'Department Wise Leave' };

/** `status` 0 pending, 1 approved, anything else cancelled - as in the Blade. */
function statusBadge(status: number | null) {
  if (status === 0) return { label: 'Pending', color: 'warning' as const };
  if (status === 1) return { label: 'Approved', color: 'success' as const };
  return { label: 'Cancelled', color: 'light' as const };
}

export default async function DepartmentWiseLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ department_id?: string; user_id?: string }>;
}) {
  await authorize('approve.leave.department');
  const sp = await searchParams;

  const departmentId = sp.department_id ? Number(sp.department_id) : undefined;
  const userId = sp.user_id ? Number(sp.user_id) : undefined;

  const [departments, staffResult, canDelete] = await Promise.all([
    departmentRepository.all(),
    departmentId
      ? listStaff({ departmentId, perPage: 500 })
      : Promise.resolve({ rows: [] as Awaited<ReturnType<typeof listStaff>>['rows'] }),
    can('apply_leave.destroy'),
  ]);

  // The Blade only listed leave once a staff member was chosen.
  const leaves = userId ? await listLeaveApplications({ userId, perPage: 500 }) : null;

  const rows = leaves
    ? await Promise.all(
        leaves.rows.map(async (row) => ({
          ...row,
          startLabel: await dateConvert(row.leave.startDate),
          endLabel: row.leave.endDate ? await dateConvert(row.leave.endDate) : '-',
          applyLabel: await dateConvert(row.leave.applyDate),
        })),
      )
    : [];

  const action = ROUTES['approve.leave.department'];
  const filtered = Boolean(departmentId || userId);

  return (
    <>
      <PageHeader
        title="Department Wise Leave"
        breadcrumb={[{ label: 'Leave' }, { label: 'Department Wise' }]}
      />

      <Card title="Select Criteria" desc="Choose a department, then a member of its staff.">
        <form action={action} method="get" className="flex flex-wrap items-end gap-3">
          <FormSelect
            name="department_id"
            label="Department"
            defaultValue={sp.department_id ?? ''}
            placeholder="Select department"
            options={departments.map((d) => ({ value: d.id, label: d.name ?? '' }))}
            wrapperClassName="min-w-48 flex-1"
          />
          <FormSelect
            name="user_id"
            label="Staff"
            defaultValue={sp.user_id ?? ''}
            placeholder={departmentId ? 'Select staff' : 'Choose a department first'}
            options={staffResult.rows.map((r) => ({
              value: r.user.id,
              label: r.user.name ?? '',
            }))}
            disabled={!departmentId}
            wrapperClassName="min-w-48 flex-1"
          />
          <Button type="submit" variant="soft">
            <Filter />
            Search
          </Button>
          {filtered ? (
            <LinkButton href={action} variant="ghost">
              <X />
              Clear
            </LinkButton>
          ) : null}
        </form>
      </Card>

      {userId ? (
        <>
        <ReportSummary
          className="mt-5"
          figures={[
            { label: 'Departments', value: departments.length, detail: 'Available to filter by', icon: Building2 },
            {
              label: 'Staff in department',
              value: staffResult.rows.length,
              detail: 'Active members',
              icon: Users,
            },
            { label: 'Leave applications', value: rows.length, detail: 'For this person', icon: CalendarClock },
            {
              label: 'Approved',
              value: rows.filter((row) => row.leave.status === 1).length,
              detail: 'Signed off',
              icon: CalendarCheck,
            },
          ]}
        />

        <Card title="Leave" bodyClassName="" className="mt-5">
          <DataTable
            columns={[
              { label: 'ID' },
              { label: 'Type' },
              { label: 'Staff' },
              { label: 'Email' },
              { label: 'From' },
              { label: 'To' },
              { label: 'Apply Date' },
              { label: 'Status' },
              ...(canDelete ? [{ label: 'Action' }] : []),
            ]}
            isEmpty={rows.length === 0}
            empty="This staff member has no leave applications."
          >
            {rows.map((row, index) => {
              const badge = statusBadge(row.leave.status);
              return (
                <Tr key={row.leave.id}>
                  <Td>{index + 1}</Td>
                  <Td>{row.leaveTypeName ?? '-'}</Td>
                  <Td>{row.userName ?? '-'}</Td>
                  <Td>{row.userEmail ?? '-'}</Td>
                  <Td>{row.startLabel}</Td>
                  <Td>{row.endLabel}</Td>
                  <Td>{row.applyLabel}</Td>
                  <Td>
                    <Badge color={badge.color}>{badge.label}</Badge>
                  </Td>
                  {canDelete ? (
                    <Td>
                      <form action={deleteLeaveApplicationAction}>
                        <input type="hidden" name="id" value={row.leave.id} />
                        <ActionButton variant="danger" confirm="Delete this application?">
                          Delete
                        </ActionButton>
                      </form>
                    </Td>
                  ) : null}
                </Tr>
              );
            })}
          </DataTable>
        </Card>
        </>
      ) : null}
    </>
  );
}
