// Quotation - port of QuotationController@print_view
// (`quotation::quotation.print_view`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findQuotation } from '@/lib/quotation/repository';
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

export const metadata: Metadata = { title: 'Quotation' };

export default async function QuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const [amountLabel, discountLabel, taxLabel, payableLabel, dateLabel] =
    await Promise.all([
      singlePrice(quotation.amount),
      singlePrice(quotation.totalDiscount),
      singlePrice(quotation.totalVat),
      singlePrice(quotation.payableAmount),
      dateConvert(quotation.date),
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
        title="Quotation"
        left={[
          { label: 'Quotation No', value: quotation.invoiceNo ?? String(quotation.id) },
          { label: 'Date', value: dateLabel },
          { label: 'Reference', value: quotation.refNo ?? '-' },
        ]}
        right={[
          { label: 'Customer', value: customer?.name ?? '-' },
          { label: 'Mobile', value: customer?.mobile ?? '-' },
          { label: 'Email', value: customer?.email ?? '-' },
          { label: 'Address', value: customer?.address ?? '-' },
        ]}
      />

      <PrintLines lines={lines} />

      <PrintTotals
        rows={[
          { label: 'Items total', value: amountLabel },
          { label: 'Discount', value: discountLabel },
          { label: 'Tax', value: taxLabel },
          { label: 'Payable', value: payableLabel, strong: true },
        ]}
        note={quotation.notes ? <p className="whitespace-pre-wrap">{quotation.notes}</p> : null}
      />

      <PrintFooter terms={setting.termsConditions} />
    </>
  );
}
