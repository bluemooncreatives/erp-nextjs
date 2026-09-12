// Staff report - port of StaffReportController@index / @search
// (`report::staff_report.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { listStaff } from '@/lib/hr/staff';
import { departmentRepository } from '@/lib/product/repositories';
import { locationOptions } from '@/lib/setup/repositories';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { UserCheck, UserX, Wallet, Building2 } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Staff Report' };

export default async function StaffReportPage({
  searchParams,
}: {
  searchParams: Promise<{ department_id?: string; showroom_id?: string }>;
}) {
  await authorize('staff_report.index');
  const sp = await searchParams;

  const [{ rows }, departments, locations] = await Promise.all([
    listStaff({
      departmentId: sp.department_id ? Number(sp.department_id) : undefined,
      showroomId: sp.showroom_id ? Number(sp.showroom_id) : undefined,
      perPage: 500,
    }),
    departmentRepository.all(),
    locationOptions(),
  ]);

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      joiningLabel: await dateConvert(row.staff.dateOfJoining),
      salaryLabel: await singlePrice(Number(row.staff.basicSalary ?? 0)),
    })),
  );

  const activeCount = decorated.filter((row) => row.user.isActive === 1).length;
  const departmentCount = new Set(decorated.map((row) => row.departmentName).filter(Boolean)).size;
  const salaryLabel = await singlePrice(
    decorated.reduce((sum, row) => sum + Number(row.staff.basicSalary ?? 0), 0),
  );

  return (
    <>
      <PageHeader
        title="Staff Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Staff Report' }]}
        actions={
          <ReportFilter
            action={ROUTES['staff_report.index']}
            selects={[
              {
                name: 'department_id',
                placeholder: 'All departments',
                value: sp.department_id,
                options: departments.map((d) => ({ value: d.id, label: d.name ?? '' })),
              },
              {
                name: 'showroom_id',
                placeholder: 'All branches',
                value: sp.showroom_id,
                options: locations
                  .filter((l) => String(l.value).startsWith('showroom-'))
                  .map((l) => ({
                    value: String(l.value).split('-')[1],
                    label: l.label,
                  })),
              },
            ]}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Active', value: activeCount, detail: 'Matching the filters', icon: UserCheck },
          { label: 'Inactive', value: decorated.length - activeCount, detail: 'Matching the filters', icon: UserX },
          { label: 'Basic salary', value: salaryLabel, detail: 'Combined, for the staff shown', icon: Wallet },
          { label: 'Departments', value: departmentCount, detail: 'Represented in this report', icon: Building2 },
        ]}
      />

      <Card title={`Staff (${decorated.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Employee ID' },
            { label: 'Name' },
            { label: 'Role' },
            { label: 'Department' },
            { label: 'Joined' },
            { label: 'Basic Salary' },
            { label: 'Status' },
            { label: '' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No staff match this filter."
        >
          {decorated.map((row) => (
            <Tr key={row.staff.id}>
              <Td>{row.staff.employeeId ?? '-'}</Td>
              <Td className="font-medium text-foreground">
                {row.user.name}
              </Td>
              <Td>{row.roleName ?? '-'}</Td>
              <Td>{row.departmentName ?? '-'}</Td>
              <Td>{row.joiningLabel}</Td>
              <Td>{row.salaryLabel}</Td>
              <Td>
                <Badge color={row.user.isActive === 1 ? 'success' : 'error'} size="sm">
                  {row.user.isActive === 1 ? 'Active' : 'Inactive'}
                </Badge>
              </Td>
              <Td>
                <Link
                  href={route('staff_report.history', { id: row.staff.id })}
                  className="text-xs font-medium text-primary hover:text-primary"
                >
                  History
                </Link>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
