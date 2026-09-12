// Income by customer - port of the `income_by_customer` account report.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { incomeByCustomer } from '@/lib/reports/queries';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportSummary } from '@/components/erp/report-summary';
import { FileText, Users, Wallet } from 'lucide-react';
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
  const invoiceCount = rows.reduce((sum, r) => sum + r.invoices, 0);

  return (
    <>
      <PageHeader
        title="Income By Customer"
        breadcrumb={[{ label: 'Accounts'}, { label:'Income By Customer' }]}
        actions={
          <ReportFilter
            action={ROUTES['income_by_customer']}
            from={sp.from}
            to={sp.to}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Customers', value: rows.length, detail: 'Billed in this period', icon: Users },
          { label: 'Invoices', value: invoiceCount, detail: 'Across every customer', icon: FileText },
          {
            label: 'Total income',
            value: `${symbol} ${numberFormat(grandTotal)}`,
            detail: 'In this period',
            icon: Wallet,
          },
        ]}
      />

      <Card title="Income by customer" bodyClassName="">
        <DataTable
          columns={[{ label: 'Customer' }, { label: 'Invoices'}, { label:'Total' }]}
          isEmpty={rows.length === 0}
          empty="No income in this period."
        >
          {rows.map((r) => (
            <Tr key={r.customerId ?? 'none'}>
              <Td className="font-medium text-foreground">
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
