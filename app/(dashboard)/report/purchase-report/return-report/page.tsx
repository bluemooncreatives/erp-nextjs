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

      <Card title={`Returns (${rows.length}) - ${totalLabel}`} bodyClassName="">
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
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                <Link
                  href={route('purchase_order.show', { id: row.order.id })}
                  className="text-brand-500 hover:text-brand-600"
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
