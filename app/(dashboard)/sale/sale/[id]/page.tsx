import { LinkButton } from '@/components/common/link-button';
// Sale detail - port of SaleController@show (`sale::sale.show` /
// `invoice_details`), including the payment panel and return entry.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize, can } from '@/lib/auth/permissions';
import { findSale, SaleStatus, SaleReturnStatus } from '@/lib/sale/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, DetailList } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { approveSaleAction } from '../../actions';
import { PaymentPanel } from './payment-panel';
import { ReturnPanel } from './return-panel';
import { ShippingPanel } from './shipping-panel';

export const metadata: Metadata = { title: 'Invoice' };

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('sale.show');
  const { id } = await params;

  const found = await findSale(Number(id));
  if (!found) notFound();

  const { sale, items, payments, shipping, customer, agent, location } = found;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const money = (v: number | string) => `${symbol} ${numberFormat(v)}`;

  const paidAmount = payments.reduce(
    (sum, p) => sum + Number(p.amount) - Number(p.returnAmount),
    0,
  );
  const dueAmount = Number(sale.payableAmount) - paidAmount;

  const [canApprove, canPay, canReturn, canShip] = await Promise.all([
    can('conditional.sale.approve'),
    can('sale.payment'),
    can('sale.return'),
    can('store.shipping'),
  ]);

  const accounts = await paymentAccountOptions();

  return (
    <>
      <PageHeader
        title={`Invoice ${sale.invoiceNo ?? sale.id}`}
        breadcrumb={[
          { label: 'Sale', href: ROUTES['sale.index'] },
          { label: sale.invoiceNo ?? String(sale.id) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <LinkButton
              href={route('sale.print_view', { id: sale.id })}
              variant="outline"
            >
              Print
            </LinkButton>
            <LinkButton
              href={route('sale.pdf', { id: sale.id })}
              variant="outline"
            >
              Pdf
            </LinkButton>
            <LinkButton
              href={route('sale.challan_pdf', { id: sale.id })}
              variant="outline"
            >
              Challan
            </LinkButton>
            {sale.isApproved !== 1 && canApprove ? (
              <form action={approveSaleAction}>
                <input type="hidden" name="id" value={sale.id} />
                <ActionButton
                  variant="primary"
                  className="px-4 py-2.5 text-sm"
                  confirm="Approve this invoice? Stock will be deducted and the ledger posted."
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
          <Card title="Invoice Details">
            <DetailList
              items={[
                { label: 'Invoice No', value: sale.invoiceNo ?? '-' },
                { label: 'Reference No', value: sale.refNo ??'-' },
                { label: 'Date', value: await dateConvert(sale.date) },
                {
                  label: 'Customer',
                  value: customer?.name ?? agent?.name ?? '-',
                },
                { label: 'Branch / Warehouse', value: location?.name ?? '-' },
                {
                  label: 'Approval',
                  value:
                    sale.isApproved === 1 ? (
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
                  label: 'Payment Status',
                  value: (
                    <Badge
                      size="sm"
                      color={
                        sale.status === SaleStatus.Paid
                          ? 'success'
                          : sale.status === SaleStatus.Partial
                            ? 'warning'
                            : 'error'
                      }
                    >
                      {sale.status === SaleStatus.Paid
                        ? 'Paid'
                        : sale.status === SaleStatus.Partial
                          ? 'Partial'
                          : 'Unpaid'}
                    </Badge>
                  ),
                },
                {
                  label: 'Return Status',
                  value:
                    sale.returnStatus === SaleReturnStatus.Accepted
                      ? 'Accepted'
                      : sale.returnStatus === SaleReturnStatus.Pending
                        ? 'Pending'
                        : 'None',
                },
              ]}
            />
            {sale.notes ? (
              <p className="mt-5 whitespace-pre-line text-sm text-muted-foreground">
                {sale.notes}
              </p>
            ) : null}
          </Card>

          <Card title="Items" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Product' },
                { label: 'Price' },
                { label: 'Qty' },
                { label: 'Tax %' },
                { label: 'Disc %' },
                { label: 'Subtotal' },
                { label: 'Returned' },
              ]}
              isEmpty={items.length === 0}
            >
              {items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium text-foreground">
                    {item.name ?? item.sku ?? item.productSkuId}
                  </Td>
                  <Td>{money(item.price)}</Td>
                  <Td>{item.quantity}</Td>
                  <Td>{numberFormat(item.tax)}</Td>
                  <Td>{numberFormat(item.discount)}</Td>
                  <Td>{money(item.subTotal)}</Td>
                  <Td>
                    {item.returnQuantity > 0
                      ? `${item.returnQuantity} (${money(item.returnAmount)})`
                      : '-'}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          {canReturn && sale.isApproved === 1 ? (
            <ReturnPanel
              saleId={sale.id}
              items={items.map((i) => ({
                id: i.id,
                name: i.name ?? i.sku ?? String(i.productSkuId),
                quantity: i.quantity,
                returnQuantity: i.returnQuantity,
              }))}
              disabled={sale.returnStatus === SaleReturnStatus.Accepted}
            />
          ) : null}
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-6">
          <Card title="Summary">
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Items total" value={money(sale.amount)} />
              <SummaryRow label="Discount" value={`- ${money(sale.totalDiscount)}`} />
              <SummaryRow label="Tax" value={money(sale.totalTax)} />
              <SummaryRow label="Shipping" value={money(sale.shippingCharge)} />
              <SummaryRow label="Other charges" value={money(sale.otherCharge)} />
              <div className="border-t border-border pt-3">
                <SummaryRow label="Payable" value={money(sale.payableAmount)} strong />
                <SummaryRow label="Paid" value={money(paidAmount)} />
                <SummaryRow label="Due" value={money(dueAmount)} strong />
              </div>
            </dl>
          </Card>

          <Card title="Payments" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Method' },
                { label: 'Amount' },
                { label: 'Advance' },
              ]}
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
            <PaymentPanel
              saleId={sale.id}
              dueAmount={dueAmount}
              currencySymbol={symbol}
              accounts={accounts.map((a) => ({
                value: a.id,
                label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
              }))}
            />
          ) : null}

          {canShip ? (
            <ShippingPanel
              saleId={sale.id}
              shipping={
                shipping
                  ? {
                      id: shipping.id,
                      shippingName: shipping.shippingName,
                      shippingRef: shipping.shippingRef,
                      date: shipping.date,
                      receivedDate: shipping.receivedDate,
                      receivedBy: shipping.receivedBy,
                    }
                  : null
              }
            />
          ) : null}

          {shipping ? (
            <Card title="Shipping">
              <DetailList
                columns={1}
                items={[
                  { label: 'Carrier', value: shipping.shippingName ?? '-' },
                  { label: 'Reference', value: shipping.shippingRef ?? '-' },
                  { label: 'Received by', value: shipping.receivedBy ?? '-' },
                  {
                    label: 'Received date',
                    value: shipping.receivedDate
                      ? await dateConvert(shipping.receivedDate)
                      : '-',
                  },
                ]}
              />
            </Card>
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
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          strong
            ? 'text-base font-semibold text-foreground '
            : 'text-foreground '
        }
      >
        {value}
      </dd>
    </div>
  );
}
