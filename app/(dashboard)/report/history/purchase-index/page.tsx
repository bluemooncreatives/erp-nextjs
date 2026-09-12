// Purchase history - port of HistoryController@purchaseHistory / @searchPurchase
// (`report::history.purchase_history`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { purchaseHistory } from '@/lib/reports/queries';
import { supplierOptions } from '@/lib/contact/queries';
import { locationOptions } from '@/lib/setup/repositories';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Wallet, Receipt, Users, Divide } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Purchase History' };

export default async function PurchaseHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    supplier_id?: string;
    house_id?: string;
  }>;
}) {
  const user = await authorize('purchase.history');
  const sp = await searchParams;
  const session = await getSession();

  const [rows, suppliers, locations] = await Promise.all([
    purchaseHistory({
      from: sp.from,
      to: sp.to,
      supplierId: sp.supplier_id ? Number(sp.supplier_id) : undefined,
      locationRef: sp.house_id,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    supplierOptions(),
    locationOptions(),
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

  // An average alongside the total tells you whether a period's value came from
  // volume or from a few large purchase orders, which the total alone hides.
  const averageLabel = await singlePrice(
    rows.length ? rows.reduce((sum, r) => sum + Number(r.order.payableAmount), 0) / rows.length : 0,
  );
  const partyCount = new Set(rows.map((r) => r.supplierName).filter(Boolean)).size;

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
              {
                name: 'house_id',
                placeholder: 'All branches and warehouses',
                value: sp.house_id,
                options: locations,
              },
            ]}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Value in range', value: total, detail: 'Total over the selected filters', icon: Wallet },
          { label: 'Purchase orders', value: rows.length.toLocaleString('en-US'), detail: 'Matching the filters', icon: Receipt },
          { label: 'Average', value: averageLabel, detail: 'Per record in range', icon: Divide },
          { label: 'Suppliers', value: partyCount, detail: 'Distinct, in range', icon: Users },
        ]}
      />

      <Card title={`Purchase orders (${rows.length})`} bodyClassName="">
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
              <Td className="font-medium text-foreground">
                <Link
                  href={route('purchase_order.show', { id: row.order.id })}
                  className="text-primary hover:text-primary"
                >
                  {row.order.invoiceNo || row.order.id}
                </Link>
              </Td>
              <Td>{row.supplierName ?? '-'}</Td>
              <Td>{row.showroomName ?? '-'}</Td>
              <Td>
                <Badge color={row.order.status === 1 ? 'success' : 'warning'} size="sm">
                  {row.order.status === 1 ? 'Approved':'Pending'}
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
