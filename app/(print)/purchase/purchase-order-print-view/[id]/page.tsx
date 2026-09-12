// Purchase order - port of PurchaseController@print_view
// (`purchase::purchase.print_view`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findPurchaseOrder } from '@/lib/purchase/repository';
import { dateConvert, generalSetting, singlePrice } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';
import {
  PrintHeader,
  PrintMeta,
  PrintLines,
  PrintTotals,
  PrintFooter,
} from '@/components/erp/print-invoice';

export const metadata: Metadata = { title: 'Purchase Order' };

export default async function PurchaseOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const record = await findPurchaseOrder(Number(id));
  if (!record) notFound();

  const { order, items, payments, supplier } = record;
  const setting = await generalSetting();

  const paid = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount) + Number(payment.advanceAmount) - Number(payment.returnAmount),
    0,
  );

  const lines = await Promise.all(
    items.map(async (item) => ({
      name: item.productName ?? item.sku ?? String(item.productSkuId),
      price: await singlePrice(item.price),
      quantity: item.quantity,
      tax: `${item.tax ?? 0}%`,
      discount: String(item.discount ?? 0),
      subTotal: await singlePrice(item.subTotal),
    })),
  );

  const [
    amountLabel,
    discountLabel,
    taxLabel,
    shippingLabel,
    payableLabel,
    paidLabel,
    dueLabel,
    dateLabel,
  ] = await Promise.all([
    singlePrice(order.amount),
    singlePrice(order.totalDiscount),
    singlePrice(order.totalVat),
    singlePrice(order.shippingCharge),
    singlePrice(order.payableAmount),
    singlePrice(paid),
    singlePrice(Number(order.payableAmount) - paid),
    dateConvert(order.date),
  ]);

  return (
    <>
      <PrintButton />

      <PrintHeader
        company={{
          name: setting.companyName ?? setting.siteTitle ?? '',
          phone: setting.phone ?? '',
          email: setting.email ?? '',
          address: setting.address ?? '',
          logoUrl: assetUrl(setting.logo),
        }}
      />

      <PrintMeta
        title="Purchase Order"
        left={[
          { label: 'Order No', value: order.invoiceNo ?? String(order.id) },
          { label: 'Date', value: dateLabel },
          { label: 'Reference', value: order.refNo ?? '-' },
        ]}
        right={[
          { label: 'Supplier', value: supplier?.name ?? '-' },
          { label: 'Mobile', value: supplier?.mobile ?? '-' },
          { label: 'Email', value: supplier?.email ?? '-' },
          { label: 'Address', value: supplier?.address ?? '-' },
        ]}
      />

      <PrintLines lines={lines} />

      <PrintTotals
        rows={[
          { label: 'Items total', value: amountLabel },
          { label: 'Discount', value: discountLabel },
          { label: 'Tax', value: taxLabel },
          { label: 'Shipping', value: shippingLabel },
          { label: 'Payable', value: payableLabel, strong: true },
          { label: 'Paid', value: paidLabel },
          { label: 'Due', value: dueLabel },
        ]}
        note={order.notes ? <p className="whitespace-pre-wrap">{order.notes}</p> : null}
      />

      <PrintFooter terms={setting.termsConditions} />
    </>
  );
}
