// `purchase.order.pdf` - PurchaseOrderController@fileDownload's real PHP
// counterpart, `PurchaseController@pdf`. dompdf produced a file here; this
// now does too, from the same data `purchase-order-print-view` renders.

import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findPurchaseOrder } from '@/lib/purchase/repository';
import { dateConvert, generalSetting, singlePrice } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { pdfResponse } from '@/lib/pdf/build';
import { invoiceDocument } from '@/lib/pdf/invoice';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
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

  const definition = invoiceDocument({
    title: 'Purchase Order',
    company: {
      name: setting.companyName ?? setting.siteTitle ?? '',
      phone: setting.phone ?? '',
      email: setting.email ?? '',
      address: setting.address ?? '',
      logoUrl: assetUrl(setting.logo),
    },
    meta: {
      left: [
        { label: 'Order No', value: order.invoiceNo ?? String(order.id) },
        { label: 'Date', value: dateLabel },
        { label: 'Reference', value: order.refNo ?? '-' },
      ],
      right: [
        { label: 'Supplier', value: supplier?.name ?? '-' },
        { label: 'Mobile', value: supplier?.mobile ?? '-' },
        { label: 'Email', value: supplier?.email ?? '-' },
        { label: 'Address', value: supplier?.address ?? '-' },
      ],
    },
    lines,
    totals: [
      { label: 'Items total', value: amountLabel },
      { label: 'Discount', value: discountLabel },
      { label: 'Tax', value: taxLabel },
      { label: 'Shipping', value: shippingLabel },
      { label: 'Payable', value: payableLabel, strong: true },
      { label: 'Paid', value: paidLabel },
      { label: 'Due', value: dueLabel },
    ],
    note: order.notes,
    terms: setting.termsConditions,
  });

  return pdfResponse(definition, `PurchaseOrder-${order.invoiceNo ?? order.id}.pdf`);
}
