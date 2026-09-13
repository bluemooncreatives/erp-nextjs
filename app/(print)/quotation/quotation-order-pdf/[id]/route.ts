// `quotation.order.pdf` - QuotationController@pdf. dompdf produced a file
// here; this now does too, from the same data `quotation-order-print-view`
// renders.

import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findQuotation } from '@/lib/quotation/repository';
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

  const record = await findQuotation(Number(id));
  if (!record) notFound();

  const { quotation, items, customer } = record;
  const setting = await generalSetting();

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

  const [amountLabel, discountLabel, taxLabel, payableLabel, dateLabel] = await Promise.all([
    singlePrice(quotation.amount),
    singlePrice(quotation.totalDiscount),
    singlePrice(quotation.totalVat),
    singlePrice(quotation.payableAmount),
    dateConvert(quotation.date),
  ]);

  const definition = invoiceDocument({
    title: 'Quotation',
    company: {
      name: setting.companyName ?? setting.siteTitle ?? '',
      phone: setting.phone ?? '',
      email: setting.email ?? '',
      address: setting.address ?? '',
      logoUrl: assetUrl(setting.logo),
    },
    meta: {
      left: [
        { label: 'Quotation No', value: quotation.invoiceNo ?? String(quotation.id) },
        { label: 'Date', value: dateLabel },
        { label: 'Reference', value: quotation.refNo ?? '-' },
      ],
      right: [
        { label: 'Customer', value: customer?.name ?? '-' },
        { label: 'Mobile', value: customer?.mobile ?? '-' },
        { label: 'Email', value: customer?.email ?? '-' },
        { label: 'Address', value: customer?.address ?? '-' },
      ],
    },
    lines,
    totals: [
      { label: 'Items total', value: amountLabel },
      { label: 'Discount', value: discountLabel },
      { label: 'Tax', value: taxLabel },
      { label: 'Payable', value: payableLabel, strong: true },
    ],
    note: quotation.notes,
    terms: setting.termsConditions,
  });

  return pdfResponse(definition, `Quotation-${quotation.invoiceNo ?? quotation.id}.pdf`);
}
