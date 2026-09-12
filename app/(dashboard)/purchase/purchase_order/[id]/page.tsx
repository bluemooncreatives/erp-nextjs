// Purchase order detail - port of PurchaseOrderController@show.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authorize, can } from '@/lib/auth/permissions';
import {
  PurchaseStatus,
  PurchaseStock,
  findPurchaseOrder,
} from '@/lib/purchase/repository';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, DetailList } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { approvePurchaseAction } from '../../actions';
import { PurchasePaymentPanel } from './payment-panel';
import { ReceivePanel } from './receive-panel';

export const metadata: Metadata = { title: 'Purchase Order' };

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('purchase_order.show');
  const { id } = await params;

  const found = await findPurchaseOrder(Number(id));
  if (!found) notFound();

  const { order, items, payments, supplier, received } = found;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const money = (v: number | string) => `${symbol} ${numberFormat(v)}`;

  const paidAmount = payments.reduce(
    (sum, p) => sum + Number(p.amount) - Number(p.returnAmount),
    0,
  );
  const dueAmount = Number(order.payableAmount) - paidAmount;

  const receivedBySku = new Map<number, number>();
  for (const r of received) {
    receivedBySku.set(
      r.productSkuId,
      (receivedBySku.get(r.productSkuId) ?? 0) + (r.receiveQuantity ?? 0),
    );
  }

  const [canApprove, canPay, canReceive] = await Promise.all([
    can('purchase.approve'),
    can('purchase.payment'),
    can('purchase.add.stock'),
  ]);

  const accounts = await paymentAccountOptions();
  const dateLabel = await dateConvert(order.date);

  return (
    <>
      <PageHeader
        title={`Purchase ${order.invoiceNo || order.id}`}
        breadcrumb={[
          { label: 'Purchase', href: ROUTES['purchase_order.index'] },
          { label: order.invoiceNo || String(order.id) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={route('purchase.order.print_view', { id: order.id })}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
            >
              Print
            </Link>
            <Link
              href={route('purchase.order.pdf', { id: order.id })}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
            >
              Export
            </Link>
            {order.status !== PurchaseStatus.Approved && canApprove ? (
            <form action={approvePurchaseAction}>
              <input type="hidden" name="id" value={order.id} />
              <ActionButton
                variant="primary"
                className="px-4 py-2.5 text-sm"
                confirm="Approve this purchase order? The ledger will be posted."
              >
                Approve
              </ActionButton>
            </form>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-8 space-y-6">
          <Card title="Order Details">
            <DetailList
              items={[
                { label: 'Invoice No', value: order.invoiceNo || '-' },
                { label: 'Reference No', value: order.refNo ?? '-' },
                { label: 'LC No', value: order.lcNo ?? '-' },
                { label: 'Date', value: dateLabel },
                { label: 'Supplier', value: supplier?.name ?? '-' },
                { label: 'Shipping Address', value: order.shippingAddress ?? '-' },
                {
                  label: 'Status',
                  value:
                    order.status === PurchaseStatus.Approved ? (
                      <Badge size="sm" color="success">
                        Approved
                      </Badge>
                    ) : (
                      <Badge size="sm" color="warning">
                        Pending
                      </Badge>
                    ),
                },
                {
                  label: 'Stock',
                  value:
                    order.addedToStock === PurchaseStock.Full
                      ? 'Fully received'
                      : order.addedToStock === PurchaseStock.Partial
                        ? 'Partially received'
                        : 'Not received',
                },
              ]}
            />
            {order.notes ? (
              <p className="mt-5 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">
                {order.notes}
              </p>
            ) : null}
          </Card>

          <Card title="Items" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Product' },
                { label: 'Price' },
                { label: 'Qty' },
                { label: 'Received' },
                { label: 'Tax %' },
                { label: 'Subtotal' },
              ]}
              isEmpty={items.length === 0}
            >
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {item.productName ?? item.sku ?? item.productSkuId}
                  </Td>
                  <Td>{money(item.price)}</Td>
                  <Td>{item.quantity}</Td>
                  <Td>{receivedBySku.get(item.productSkuId) ?? 0}</Td>
                  <Td>{numberFormat(item.tax)}</Td>
                  <Td>{money(item.subTotal)}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          {canReceive && order.addedToStock !== PurchaseStock.Full ? (
            <ReceivePanel
              purchaseId={order.id}
              items={items.map((i) => ({
                productSkuId: i.productSkuId,
                name: i.productName ?? i.sku ?? String(i.productSkuId),
                ordered: i.quantity,
                received: receivedBySku.get(i.productSkuId) ?? 0,
              }))}
            />
          ) : null}
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-6">
          <Card title="Summary">
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Items total" value={money(order.amount)} />
              <SummaryRow label="Discount" value={`- ${money(order.totalDiscount)}`} />
              <SummaryRow label="Tax" value={`${numberFormat(order.totalVat)}%`} />
              <SummaryRow label="Shipping" value={money(order.shippingCharge)} />
              <SummaryRow label="Other charges" value={money(order.otherCharge)} />
              <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                <SummaryRow label="Payable" value={money(order.payableAmount)} strong />
                <SummaryRow label="Paid" value={money(paidAmount)} />
                <SummaryRow label="Due" value={money(dueAmount)} strong />
              </div>
            </dl>
          </Card>

          <Card title="Payments" bodyClassName="">
            <DataTable
              columns={[{ label: 'Method' }, { label: 'Amount' }, { label: 'Advance' }]}
              isEmpty={payments.length === 0}
              empty="No payments yet."
            >
              {payments.map((payment) => (
                <Tr key={payment.id}>
                  <Td>{payment.paymentMethod}</Td>
                  <Td>{money(payment.amount)}</Td>
                  <Td>{money(payment.advanceAmount)}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          {canPay && dueAmount > 0 ? (
            <PurchasePaymentPanel
              purchaseId={order.id}
              dueAmount={dueAmount}
              currencySymbol={symbol}
              accounts={accounts.map((a) => ({
                value: a.id,
                label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
              }))}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={
          strong
            ? 'text-base font-semibold text-gray-800 dark:text-white/90'
            : 'text-gray-700 dark:text-gray-300'
        }
      >
        {value}
      </dd>
    </div>
  );
}
