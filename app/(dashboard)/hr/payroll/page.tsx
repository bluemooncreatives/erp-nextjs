// Payroll - port of PayrollController@index.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listPayrolls, payableStaff } from '@/lib/hr/leave';
import { regularUserRoles } from '@/lib/hr/staff';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Hourglass, CircleCheck, Wallet, Users } from 'lucide-react';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { deletePayrollAction, setPayrollStatusAction } from '../../leave/actions';
import { GeneratePayrollPanel } from './generate-payroll-panel';

export const metadata: Metadata = { title: 'Payroll' };

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    year?: string;
    page?: string;
    role_id?: string;
  }>;
}) {
  await authorize('payroll.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listPayrolls({
    month: sp.month,
    year: sp.year,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('save_payroll'),
    can('save_payroll'),
    can('payroll_payment_store'),
  ]);

  const roleId = sp.role_id ? Number(sp.role_id) : null;
  const [staffOptions, roles] = await Promise.all([
    canCreate ? payableStaff(roleId) : Promise.resolve([]),
    canCreate ? regularUserRoles() : Promise.resolve([]),
  ]);

  const payrollRows = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      paymentLabel: r.payroll.paymentDate
        ? await dateConvert(r.payroll.paymentDate)
        : '-',
    })),
  );

  const control =
    'h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground   ';

  // Payroll is read for "what still has to be paid, and how much", so the
  // unpaid queue and its net value lead.
  const paidCount = payrollRows.filter((r) => r.payroll.payrollStatus === 'Paid').length;
  const unpaidCount = payrollRows.length - paidCount;
  const netTotal = payrollRows.reduce((sum, r) => sum + Number(r.payroll.netSalary ?? 0), 0);
  const unpaidTotal = payrollRows
    .filter((r) => r.payroll.payrollStatus !== 'Paid')
    .reduce((sum, r) => sum + Number(r.payroll.netSalary ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Payroll"
        breadcrumb={[{ label: 'Human Resource'}, { label:'Payroll' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form
              action={ROUTES['payroll.index']}
              method="get"
              className="flex items-center gap-2"
            >
              <select
                name="role_id"
                defaultValue={sp.role_id ?? ''}
                className={`${control} w-40`}
              >
                <option value="">All roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="month"
                placeholder="Month"
                defaultValue={sp.month ?? ''}
                className={`${control} w-28`}
              />
              <input
                type="text"
                name="year"
                placeholder="Year"
                defaultValue={sp.year ?? ''}
                className={`${control} w-24`}
              />
              <button
                type="submit"
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Filter
              </button>
            </form>

          </div>
        }
      />

      {canCreate ? (
        <div className="mb-6">
          <GeneratePayrollPanel
            staff={staffOptions.map((s) => ({
              id: s.id,
              name: s.name,
              employeeId: s.employeeId,
              basicSalary: Number(s.basicSalary ?? 0),
              roleId: s.roleId,
              bankName: s.bankName,
              bankBranchName: s.bankBranchName,
              accountNo: s.accountNo,
            }))}
            currencySymbol={symbol}
          />
        </div>
      ) : null}

      <ReportSummary
        figures={[
          { label: 'Awaiting payment', value: unpaidCount, detail: `${symbol} ${numberFormat(unpaidTotal)} outstanding`, icon: Hourglass },
          { label: 'Paid', value: paidCount, detail: 'On this page', icon: CircleCheck },
          { label: 'Net on this page', value: `${symbol} ${numberFormat(netTotal)}`, detail: `${payrollRows.length} of ${total} payrolls`, icon: Wallet },
          { label: 'Payrolls', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Users },
        ]}
      />

      <Card title={`Payrolls (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Staff' },
            { label: 'Period' },
            { label: 'Basic' },
            { label: 'Earnings' },
            { label: 'Deductions' },
            { label: 'Tax' },
            { label: 'Net' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={payrollRows.length === 0}
          empty="No payrolls generated."
        >
          {payrollRows.map((row) => (
            <Tr key={row.payroll.id}>
              <Td>
                <p className="font-medium text-foreground">
                  {row.staffName ?? '-'}
                </p>
                <p className="text-xs text-muted-foreground">{row.employeeId ?? ''}</p>
              </Td>
              <Td>{`${row.payroll.payrollMonth ?? ''} ${row.payroll.payrollYear ?? ''}`}</Td>
              <Td>{`${symbol} ${numberFormat(row.payroll.basicSalary ?? 0)}`}</Td>
              <Td>{`${symbol} ${numberFormat(row.payroll.totalEarning ?? 0)}`}</Td>
              <Td>{`${symbol} ${numberFormat(row.payroll.totalDeduction ?? 0)}`}</Td>
              <Td>{`${symbol} ${numberFormat(row.payroll.tax ?? 0)}`}</Td>
              <Td className="font-medium">
                {`${symbol} ${numberFormat(row.payroll.netSalary ?? 0)}`}
              </Td>
              <Td>
                <Badge
                  size="sm"
                  color={row.payroll.payrollStatus === 'Paid' ? 'success' : 'warning'}
                >
                  {row.payroll.payrollStatus ?? 'Generated'}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canEdit && row.payroll.payrollStatus !== 'Paid' ? (
                    <form action={setPayrollStatusAction}>
                      <input type="hidden" name="id" value={row.payroll.id} />
                      <input type="hidden" name="status" value="Paid" />
                      <ActionButton variant="primary">Mark paid</ActionButton>
                    </form>
                  ) : null}
                  {canDelete ? (
                    <form action={deletePayrollAction}>
                      <input type="hidden" name="id" value={row.payroll.id} />
                      <ActionButton confirm="Delete this payroll?">Delete</ActionButton>
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
          baseUrl={ROUTES['payroll.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
