import { LinkButton } from '@/components/common/link-button';
// Receive your product - port of the `purchase_order.recieve.index` screen:
// purchase orders that have not been fully received into stock.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { PurchaseStock, listPurchaseOrders } from '@/lib/purchase/repository';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { PackageOpen, Hourglass, Boxes, Wallet } from 'lucide-react';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Recieve Your Product' };

export default async function ReceivePurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('purchase_order.recieve.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listPurchaseOrders({
    search: sp.search,
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
    pendingReceiptOnly: true,
  });

  const orderRows = await Promise.all(
    rows.map(async (order) => ({
      ...order,
      dateLabel: await dateConvert(order.date),
    })),
  );

  // Every row here is outstanding, so the split that matters is part-received
  // against not started, plus the value and quantity still to come in.
  const partialCount = orderRows.filter((o) => o.addedToStock === PurchaseStock.Partial).length;
  const notStartedCount = orderRows.length - partialCount;
  const pageValue = orderRows.reduce((sum, o) => sum + Number(o.payableAmount ?? 0), 0);
  const pageQuantity = orderRows.reduce((sum, o) => sum + Number(o.totalQuantity ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Recieve Your Product"
        breadcrumb={[{ label: 'Inventory'}, { label:'Recieve Your Product' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Not yet received', value: notStartedCount, detail: 'Nothing booked in', icon: Hourglass },
          { label: 'Partly received', value: partialCount, detail: 'Some stock booked in', icon: PackageOpen },
          { label: 'Units awaited', value: numberFormat(pageQuantity, 0), detail: 'On this page', icon: Boxes },
          { label: 'Value on this page', value: `${symbol} ${numberFormat(pageValue)}`, detail: `${orderRows.length} of ${total} orders`, icon: Wallet },
        ]}
      />

      <Card
        title={`Awaiting receipt (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['purchase_order.recieve.index']}
            defaultValue={sp.search}
            placeholder="Search invoice or supplier..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Supplier' },
            { label: 'Location' },
            { label: 'Qty ordered' },
            { label: 'Total' },
            { label: 'Stock' },
            { label: '' },
          ]}
          isEmpty={orderRows.length === 0}
          empty="Nothing is awaiting receipt."
        >
          {orderRows.map((order) => (
            <Tr key={order.id}>
              <Td>
                <Link
                  href={route('purchase_order.show', { id: order.id })}
                  className="font-medium text-primary hover:text-primary"
                >
                  {order.invoiceNo || order.id}
                </Link>
              </Td>
              <Td>{order.dateLabel}</Td>
              <Td>{order.supplierName ?? '-'}</Td>
              <Td>{order.locationName ?? '-'}</Td>
              <Td>{order.totalQuantity}</Td>
              <Td>{`${symbol} ${numberFormat(order.payableAmount)}`}</Td>
              <Td>
                <Badge
                  size="sm"
                  color={
                    order.addedToStock === PurchaseStock.Partial ? 'warning':'light'
                  }
                >
                  {order.addedToStock === PurchaseStock.Partial ? 'Partial':'Pending'}
                </Badge>
              </Td>
              <Td>
                <LinkButton
                  href={route('purchase_order.show', { id: order.id })}
                  
                >
                  <Phrase>Receive</Phrase>
                </LinkButton>
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['purchase_order.recieve.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
