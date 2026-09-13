import { LinkButton } from '@/components/common/link-button';
// Staff list - port of StaffController@index.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listStaff } from '@/lib/hr/staff';
import { dateConvert } from '@/lib/settings';
import { avatarUrl } from '@/lib/paths';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { UserCheck, UserX, Users } from 'lucide-react';
import {
  DataTable,
  Pagination,
  SearchBar,
  StatusBadge,
  Td,
  Tr,
} from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { deleteStaffAction, toggleStaffActive } from '../actions';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('staffs.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await listStaff({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete, canView] = await Promise.all([
    can('staffs.store'),
    can('staffs.edit'),
    can('staffs.destroy'),
    can('staffs.view'),
  ]);

  const staffRows = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      joiningLabel: r.staff.dateOfJoining ? await dateConvert(r.staff.dateOfJoining) : '-',
    })),
  );

  const activeCount = staffRows.filter((r) => r.user.isActive === 1).length;
  const inactiveCount = staffRows.length - activeCount;

  return (
    <>
      <PageHeader
        title="Staff"
        breadcrumb={[{ label: 'Human Resource'}, { label:'Staff' }]}
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-3">
              <LinkButton
                href={ROUTES['staffs.csv_upload']}
                
              >
                Upload via CSV
              </LinkButton>
              <LinkButton
                href={ROUTES['staffs.create']}
                
              >
                <Phrase>Add Staff</Phrase>
              </LinkButton>
            </div>
          ) : null
        }
      />

      <ReportSummary
        figures={[
          { label: 'Active', value: activeCount, detail: 'On this page', icon: UserCheck },
          { label: 'Inactive', value: inactiveCount, detail: 'On this page', icon: UserX },
          { label: 'Staff', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Users },
        ]}
      />

      <Card
        title={`Staff (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['staffs.index']}
            defaultValue={sp.search}
            placeholder="Search name, email or employee id..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Staff' },
            { label: 'Employee ID' },
            { label: 'Role' },
            { label: 'Department' },
            { label: 'Branch' },
            { label: 'Joined' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={staffRows.length === 0}
          empty="No staff found."
        >
          {staffRows.map((row) => (
            <Tr key={row.staff.id}>
              <Td>
                <div className="flex items-center gap-3">
                  <Image
                    src={avatarUrl(row.user.avatar ?? row.user.photo, row.user.name)}
                    alt={row.user.name}
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                  <div>
                    <p className="font-medium text-foreground">
                      {row.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.user.email}</p>
                  </div>
                </div>
              </Td>
              <Td>{row.staff.employeeId ?? '-'}</Td>
              <Td>{row.roleName ?? '-'}</Td>
              <Td>{row.departmentName ?? '-'}</Td>
              <Td>{row.showroomName ?? row.warehouseName ?? '-'}</Td>
              <Td>{row.joiningLabel}</Td>
              <Td>
                <form action={toggleStaffActive}>
                  <input type="hidden" name="id" value={row.staff.id} />
                  <input type="hidden" name="is_active" value={row.user.isActive} />
                  <ActionButton variant="outline">
                    <StatusBadge status={row.user.isActive} />
                  </ActionButton>
                </form>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canView ? (
                    <Link
                      href={route('staffs.view', { id: row.staff.id })}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      <Phrase>View</Phrase>
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <LinkButton
                      href={route('staffs.edit', { id: row.staff.id })}
                      
                    >
                      <Phrase>Edit</Phrase>
                    </LinkButton>
                  ) : null}
                  {canDelete ? (
                    <form action={deleteStaffAction}>
                      <input type="hidden" name="id" value={row.staff.id} />
                      <ActionButton
                        confirm={`Delete "${row.user.name}" and their login?`}
                      >
                        <Phrase>Delete</Phrase>
                      </ActionButton>
                    </form>
                  ) : null}
                </div>
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['staffs.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
