// `sale.pdf` - SaleController@invoicePdf. dompdf produced a file here; this
// now does too, built from the exact data `sale-print-view` renders on screen.

import { notFound } from 'next/navigation';
import { findSale } from '@/lib/sale/queries';
import { dateConvert, generalSetting, singlePrice } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import 'server-only';
import { invoiceDocument } from '@/lib/pdf/invoice';

export async function saleInvoice(id: number) {
  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, items, payments, customer, agent } = record;
  const setting = await generalSetting();

  const paid = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount) + Number(payment.advanceAmount),
    0,
  );
  const due = Number(sale.payableAmount) - paid;

  const lines = await Promise.all(
    items.map(async (item) => ({
      name: item.name ?? String(item.productSkuId),
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
    otherLabel,
    payableLabel,
    paidLabel,
    dueLabel,
    dateLabel,
  ] = await Promise.all([
    singlePrice(sale.amount),
    singlePrice(sale.totalDiscount),
    singlePrice(sale.totalTax),
    singlePrice(sale.shippingCharge),
    singlePrice(sale.otherCharge),
    singlePrice(sale.payableAmount),
    singlePrice(paid),
    singlePrice(due),
    dateConvert(sale.date),
  ]);

  const partyName = customer?.name ?? agent?.name ?? 'Walk-in Customer';

  const note = [sale.notes, setting.remarksTitle, setting.remarksBody].filter(Boolean).join('\n');

  const definition = invoiceDocument({
    title: 'Invoice',
    company: {
      name: setting.companyName ?? setting.siteTitle ?? '',
      phone: setting.phone ?? '',
      email: setting.email ?? '',
      address: setting.address ?? '',
      logoUrl: assetUrl(setting.logo),
    },
    meta: {
      left: [
        { label: 'Bill No', value: sale.invoiceNo ?? String(sale.id) },
        { label: 'Bill Date', value: dateLabel },
        { label: 'Reference', value: sale.refNo ?? '-' },
      ],
      right: [
        { label: 'Customer', value: partyName },
        { label: 'Mobile', value: customer?.mobile ?? '-' },
        { label: 'Email', value: customer?.email ?? agent?.email ?? '-' },
        { label: 'Address', value: customer?.address ?? '-' },
      ],
    },
    lines,
    totals: [
      { label: 'Items total', value: amountLabel },
      { label: 'Discount', value: discountLabel },
      { label: 'Tax', value: taxLabel },
      { label: 'Shipping', value: shippingLabel },
      { label: 'Other charges', value: otherLabel },
      { label: 'Payable', value: payableLabel, strong: true },
      { label: 'Paid', value: paidLabel },
      { label: 'Due', value: dueLabel },
    ],
    note: note || null,
    terms: setting.termsConditions,
  });

  return { definition, filename: `Invoice-${sale.invoiceNo ?? sale.id}.pdf` };
}
