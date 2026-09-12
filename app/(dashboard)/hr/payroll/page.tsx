// Payroll - port of PayrollController@index.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listPayrolls, payableStaff } from '@/lib/hr/leave';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import { deletePayrollAction, setPayrollStatusAction } from '../../leave/actions';
import { GeneratePayrollPanel } from './generate-payroll-panel';

export const metadata: Metadata = { title: 'Payroll' };

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; page?: string }>;
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
    can('payroll.store'),
    can('payroll.edit'),
    can('payroll.delete'),
  ]);

  const staffOptions = canCreate ? await payableStaff() : [];

  const payrollRows = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      paymentLabel: r.payroll.paymentDate
        ? await dateConvert(r.payroll.paymentDate)
        : '-',
    })),
  );

  const control =
    'h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

  return (
    <>
      <PageHeader
        title="Payroll"
        breadcrumb={[{ label: 'Human Resource' }, { label: 'Payroll' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form
              action={ROUTES['payroll.index']}
              method="get"
              className="flex items-center gap-2"
            >
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
                className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
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
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {row.staffName ?? '-'}
                </p>
                <p className="text-theme-xs text-gray-400">{row.employeeId ?? ''}</p>
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
