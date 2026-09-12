// Purchase return report - port of
// PurchaseReportController@purchase_return_report.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { purchaseReturnReport } from '@/lib/reports/queries';
import { supplierOptions } from '@/lib/contact/queries';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Undo2, Wallet, Users, Divide } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Purchase Return Report' };

export default async function PurchaseReturnReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; supplier_id?: string }>;
}) {
  const user = await authorize('purchase_return_report.index');
  const sp = await searchParams;
  const session = await getSession();

  const [{ rows, total }, suppliers] = await Promise.all([
    purchaseReturnReport({
      from: sp.from,
      to: sp.to,
      supplierId: sp.supplier_id ? Number(sp.supplier_id) : undefined,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    supplierOptions(),
  ]);

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      dateLabel: await dateConvert(row.order.date),
      amountLabel: await singlePrice(row.order.payableAmount),
      returnedLabel: await singlePrice(Number(row.returned ?? 0)),
    })),
  );

  const totalLabel = await singlePrice(total);
  const averageLabel = await singlePrice(rows.length ? total / rows.length : 0);
  const supplierCount = new Set(rows.map((r) => r.supplierName).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Purchase Return Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Purchase Return' }]}
        actions={
          <ReportFilter
            action={ROUTES['purchase_return_report.index']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'supplier_id',
                placeholder: 'All suppliers',
                value: sp.supplier_id,
                options: suppliers.map((s) => ({ value: s.id, label: s.name })),
              },
            ]}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Returned value', value: totalLabel, detail: 'Over the selected range', icon: Wallet },
          { label: 'Returns', value: rows.length.toLocaleString('en-US'), detail: 'Matching the filters', icon: Undo2 },
          { label: 'Average return', value: averageLabel, detail: 'Per record in range', icon: Divide },
          { label: 'Suppliers', value: supplierCount, detail: 'Distinct, in range', icon: Users },
        ]}
      />

      <Card title={`Returns (${rows.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Supplier' },
            { label: 'Order amount' },
            { label: 'Returned' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No returns match this filter."
        >
          {decorated.map((row) => (
            <Tr key={row.order.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                <Link
                  href={route('purchase_order.show', { id: row.order.id })}
                  className="text-primary hover:text-primary"
                >
                  {row.order.invoiceNo || row.order.id}
                </Link>
              </Td>
              <Td>{row.supplierName ?? '-'}</Td>
              <Td>{row.amountLabel}</Td>
              <Td>{row.returnedLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
