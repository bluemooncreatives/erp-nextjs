// Purchase history - port of HistoryController@purchaseHistory / @searchPurchase
// (`report::history.purchase_history`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { purchaseHistory } from '@/lib/reports/queries';
import { supplierOptions } from '@/lib/contact/queries';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import Badge from '@/components/ui/badge/Badge';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Purchase History' };

export default async function PurchaseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; supplier_id?: string }>;
}) {
  const user = await authorize('purchase.history');
  const sp = await searchParams;
  const session = await getSession();

  const [rows, suppliers] = await Promise.all([
    purchaseHistory({
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
    })),
  );

  const total = await singlePrice(
    rows.reduce((sum, r) => sum + Number(r.order.payableAmount), 0),
  );

  return (
    <>
      <PageHeader
        title="Purchase History"
        breadcrumb={[{ label: 'Reports' }, { label: 'Purchase History' }]}
        actions={
          <ReportFilter
            action={ROUTES['purchase.history']}
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

      <Card title={`Purchase orders (${rows.length}) - ${total}`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Supplier' },
            { label: 'Branch' },
            { label: 'Status' },
            { label: 'Amount' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No purchase orders match this filter."
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
              <Td>{row.showroomName ?? '-'}</Td>
              <Td>
                <Badge color={row.order.status === 1 ? 'success' : 'warning'} size="sm">
                  {row.order.status === 1 ? 'Approved' : 'Pending'}
                </Badge>
              </Td>
              <Td>{row.amountLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
