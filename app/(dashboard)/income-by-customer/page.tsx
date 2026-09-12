// Income by customer - port of the `income_by_customer` account report.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { incomeByCustomer } from '@/lib/reports/queries';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../report/report-filter';

export const metadata: Metadata = { title: 'Income By Customer' };

export default async function IncomeByCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await authorize('income_by_customer');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const rows = await incomeByCustomer({ from: sp.from, to: sp.to });
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <>
      <PageHeader
        title="Income By Customer"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Income By Customer' }]}
        actions={
          <ReportFilter
            action={ROUTES['income_by_customer']}
            from={sp.from}
            to={sp.to}
          />
        }
      />

      <Card
        title={`Customers (${rows.length}) - ${symbol} ${numberFormat(grandTotal)}`}
        bodyClassName=""
      >
        <DataTable
          columns={[{ label: 'Customer' }, { label: 'Invoices' }, { label: 'Total' }]}
          isEmpty={rows.length === 0}
          empty="No income in this period."
        >
          {rows.map((r) => (
            <Tr key={r.customerId ?? 'none'}>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {r.customerName ?? 'Walk-in / unassigned'}
              </Td>
              <Td>{r.invoices}</Td>
              <Td>{`${symbol} ${numberFormat(r.total)}`}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
