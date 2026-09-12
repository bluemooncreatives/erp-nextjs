// Payroll report - port of PayrollController@report_index / @searchPayrollReport
// (`payroll::payroll_reports.payroll`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { listPayrolls } from '@/lib/hr/leave';
import { roleOptions } from '@/lib/hr/staff';
import { singlePrice } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Wallet, Users, Divide, FileText } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { ReportFilter } from '../../../report/report-filter';

export const metadata: Metadata = { title: 'Payroll Report' };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default async function PayrollReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; role_id?: string }>;
}) {
  await authorize('payroll_reports.index');
  const sp = await searchParams;

  const [{ rows }, roles] = await Promise.all([
    listPayrolls({ month: sp.month, year: sp.year, perPage: 500 }),
    roleOptions(),
  ]);

  // The role filter is applied here because `listPayrolls` filters on period.
  const filtered = sp.role_id
    ? rows.filter((r) => String(r.payroll.roleId) === sp.role_id)
    : rows;

  const decorated = await Promise.all(
    filtered.map(async (row) => ({
      ...row,
      basicLabel: await singlePrice(row.payroll.basicSalary ?? 0),
      grossLabel: await singlePrice(row.payroll.grossSalary ?? 0),
      netLabel: await singlePrice(row.payroll.netSalary ?? 0),
    })),
  );

  const total = await singlePrice(
    filtered.reduce((sum, r) => sum + Number(r.payroll.netSalary ?? 0), 0),
  );
  const averageLabel = await singlePrice(
    filtered.length
      ? filtered.reduce((sum, r) => sum + Number(r.payroll.netSalary ?? 0), 0) / filtered.length
      : 0,
  );
  // `payrolls` identifies its subject by `staff_id`; there is no `user_id`.
  const staffCount = new Set(filtered.map((r) => r.payroll.staffId)).size;

  const currentYear = new Date().getUTCFullYear();

  return (
    <>
      <PageHeader
        title="Payroll Report"
        breadcrumb={[{ label: 'HR' }, { label: 'Payroll Report' }]}
        actions={
          <ReportFilter
            action={ROUTES['payroll_reports.index']}
            selects={[
              {
                name: 'role_id',
                placeholder: 'All roles',
                value: sp.role_id,
                options: roles.map((r) => ({ value: r.value, label: r.label })),
              },
              {
                name: 'month',
                placeholder: 'All months',
                value: sp.month,
                options: MONTHS.map((m) => ({ value: m, label: m })),
              },
              {
                name: 'year',
                placeholder: 'All years',
                value: sp.year,
                options: Array.from({ length: 8 }, (_, i) => {
                  const year = String(currentYear - i);
                  return { value: year, label: year };
                }),
              },
            ]}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Net payroll', value: total, detail: 'Over the selected filters', icon: Wallet },
          { label: 'Payslips', value: decorated.length.toLocaleString('en-US'), detail: 'Matching the filters', icon: FileText },
          { label: 'Staff', value: staffCount, detail: 'Distinct, in this run', icon: Users },
          { label: 'Average net', value: averageLabel, detail: 'Per payslip', icon: Divide },
        ]}
      />

      <Card title={`Payslips (${decorated.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Staff' },
            { label: 'Employee ID' },
            { label: 'Role' },
            { label: 'Month' },
            { label: 'Year' },
            { label: 'Basic' },
            { label: 'Gross' },
            { label: 'Net' },
            { label: 'Status' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No payslips match this filter."
        >
          {decorated.map((row) => (
            <Tr key={row.payroll.id}>
              <Td className="font-medium text-foreground">
{row.staffName ?? '-'}
              </Td>
              <Td>{row.employeeId ?? '-'}</Td>
              <Td>{row.roleName ?? '-'}</Td>
              <Td>{row.payroll.payrollMonth}</Td>
              <Td>{row.payroll.payrollYear}</Td>
              <Td>{row.basicLabel}</Td>
              <Td>{row.grossLabel}</Td>
              <Td>{row.netLabel}</Td>
              <Td>
                <Badge
                  color={row.payroll.payrollStatus === 'Paid' ? 'success' : 'warning'}
                  size="sm"
                >
                  {row.payroll.payrollStatus ?? 'Generated'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
