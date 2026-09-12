// Expense by supplier - port of the `expense_by_supplier` account report.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { expenseBySupplier } from '@/lib/reports/queries';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportSummary } from '@/components/erp/report-summary';
import { ReceiptText, Truck, Users } from 'lucide-react';
import { ReportFilter } from '../report/report-filter';

export const metadata: Metadata = { title: 'Expense By Supplier' };

export default async function ExpenseBySupplierPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await authorize('expense_by_supplier');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const rows = await expenseBySupplier({ from: sp.from, to: sp.to });
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const orderCount = rows.reduce((sum, r) => sum + r.orders, 0);

  return (
    <>
      <PageHeader
        title="Expense By Supplier"
        breadcrumb={[{ label: 'Accounts'}, { label:'Expense By Supplier' }]}
        actions={
          <ReportFilter
            action={ROUTES['expense_by_supplier']}
            from={sp.from}
            to={sp.to}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Suppliers', value: rows.length, detail: 'With spend in this period', icon: Users },
          { label: 'Purchase orders', value: orderCount, detail: 'Across every supplier', icon: Truck },
          {
            label: 'Total expense',
            value: `${symbol} ${numberFormat(grandTotal)}`,
            detail: 'In this period',
            icon: ReceiptText,
          },
        ]}
      />

      <Card title="Expense by supplier" bodyClassName="">
        <DataTable
          columns={[{ label: 'Supplier' }, { label: 'Orders' }, { label: 'Total' }]}
          isEmpty={rows.length === 0}
          empty="No purchases in this period."
        >
          {rows.map((r) => (
            <Tr key={r.supplierId ?? 'none'}>
              <Td className="font-medium text-foreground">
                {r.supplierName ?? 'Unassigned'}
              </Td>
              <Td>{r.orders}</Td>
              <Td>{`${symbol} ${numberFormat(r.total)}`}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
