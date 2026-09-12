// Purchase order list - port of PurchaseOrderController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import {
  PurchasePaid,
  PurchaseStatus,
  PurchaseStock,
  listPurchaseOrders,
} from '@/lib/purchase/repository';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { approvePurchaseAction, deletePurchaseAction } from '../actions';

export const metadata: Metadata = { title: 'Purchase Order' };

export default async function PurchaseOrderListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('purchase_order.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listPurchaseOrders({
    search: sp.search,
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const [canCreate, canApprove, canDelete] = await Promise.all([
    can('purchase_order.store'),
    can('purchase.approve'),
    can('purchase.order.destroy'),
  ]);

  const orderRows = await Promise.all(
    rows.map(async (order) => ({
      ...order,
      dateLabel: await dateConvert(order.date),
      dueAmount: Number(order.payableAmount) - order.paidAmount,
    })),
  );

  return (
    <>
      <PageHeader
        title="Purchase Order"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Purchase Order' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['purchase_order.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Purchase Order
            </Link>
          ) : null
        }
      />

      <Card
        title={`Purchase Orders (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['purchase_order.index']}
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
            { label: 'Total' },
            { label: 'Paid' },
            { label: 'Due' },
            { label: 'Stock' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={orderRows.length === 0}
          empty="No purchase orders found."
        >
          {orderRows.map((order) => (
            <Tr key={order.id}>
              <Td>
                <Link
                  href={route('purchase_order.show', { id: order.id })}
                  className="font-medium text-brand-500 hover:text-brand-600"
                >
                  {order.invoiceNo || order.id}
                </Link>
              </Td>
              <Td>{order.dateLabel}</Td>
              <Td>{order.supplierName ?? '-'}</Td>
              <Td>{order.locationName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(order.payableAmount)}`}</Td>
              <Td>{`${symbol} ${numberFormat(order.paidAmount)}`}</Td>
              <Td>{`${symbol} ${numberFormat(order.dueAmount)}`}</Td>
              <Td>
                <Badge
                  size="sm"
                  color={
                    order.addedToStock === PurchaseStock.Full
                      ? 'success'
                      : order.addedToStock === PurchaseStock.Partial
                        ? 'warning'
                        : 'light'
                  }
                >
                  {order.addedToStock === PurchaseStock.Full
                    ? 'Received'
                    : order.addedToStock === PurchaseStock.Partial
                      ? 'Partial'
                      : 'Pending'}
                </Badge>
              </Td>
              <Td>
                <Badge
                  size="sm"
                  color={
                    order.isPaid === PurchasePaid.Paid
                      ? 'success'
                      : order.isPaid === PurchasePaid.Partial
                        ? 'warning'
                        : 'error'
                  }
                >
                  {order.isPaid === PurchasePaid.Paid
                    ? 'Paid'
                    : order.isPaid === PurchasePaid.Partial
                      ? 'Partial'
                      : 'Unpaid'}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {order.status !== PurchaseStatus.Approved && canApprove ? (
                    <form action={approvePurchaseAction}>
                      <input type="hidden" name="id" value={order.id} />
                      <ActionButton
                        variant="primary"
                        confirm="Approve this purchase order? The ledger will be posted."
                      >
                        Approve
                      </ActionButton>
                    </form>
                  ) : null}
                  {canDelete ? (
                    <form action={deletePurchaseAction}>
                      <input type="hidden" name="id" value={order.id} />
                      <ActionButton confirm={`Delete order ${order.invoiceNo || order.id}?`}>
                        Delete
                      </ActionButton>
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
          baseUrl={ROUTES['purchase_order.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
