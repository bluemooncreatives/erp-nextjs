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

  return (
    <>
      <PageHeader
        title="Staff"
        breadcrumb={[{ label: 'Human Resource' }, { label: 'Staff' }]}
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={ROUTES['staffs.csv_upload']}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
              >
                Upload via CSV
              </Link>
              <Link
                href={ROUTES['staffs.create']}
                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
              >
                Add Staff
              </Link>
            </div>
          ) : null
        }
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
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {row.user.name}
                    </p>
                    <p className="text-theme-xs text-gray-400">{row.user.email}</p>
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
                      className="rounded-lg px-2 py-1 text-theme-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                      View
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <Link
                      href={route('staffs.edit', { id: row.staff.id })}
                      className="rounded-lg px-2 py-1 text-theme-xs font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDelete ? (
                    <form action={deleteStaffAction}>
                      <input type="hidden" name="id" value={row.staff.id} />
                      <ActionButton
                        confirm={`Delete "${row.user.name}" and their login?`}
                      >
                        Delete
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
