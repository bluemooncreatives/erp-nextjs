// Sale invoice - port of SaleController@print_view (`sale::sale.print_view`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findSale } from '@/lib/sale/queries';
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

export const metadata: Metadata = { title: 'Invoice' };

export default async function SalePrintViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, items, payments, customer, agent } = record;
  const setting = await generalSetting();

  const paid = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount) + Number(payment.advanceAmount) - Number(payment.returnAmount),
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
        title="Invoice"
        left={[
          { label: 'Bill No', value: sale.invoiceNo ?? String(sale.id) },
          { label: 'Bill Date', value: dateLabel },
          { label: 'Reference', value: sale.refNo ?? '-' },
        ]}
        right={[
          { label: 'Customer', value: partyName },
          { label: 'Mobile', value: customer?.mobile ?? '-' },
          { label: 'Email', value: customer?.email ?? agent?.email ?? '-' },
          { label: 'Address', value: customer?.address ?? '-' },
        ]}
      />

      <PrintLines lines={lines} />

      <PrintTotals
        rows={[
          { label: 'Items total', value: amountLabel },
          { label: 'Discount', value: discountLabel },
          { label: 'Tax', value: taxLabel },
          { label: 'Shipping', value: shippingLabel },
          { label: 'Other charges', value: otherLabel },
          { label: 'Payable', value: payableLabel, strong: true },
          { label: 'Paid', value: paidLabel },
          { label: 'Due', value: dueLabel },
        ]}
        note={
          <>
            {sale.notes ? <p className="whitespace-pre-wrap">{sale.notes}</p> : null}
            {setting.remarksTitle ? (
              <p className="mt-3 font-medium text-gray-800">{setting.remarksTitle}</p>
            ) : null}
            {setting.remarksBody ? (
              <p className="whitespace-pre-wrap">{setting.remarksBody}</p>
            ) : null}
          </>
        }
      />

      <PrintFooter terms={setting.termsConditions} />
    </>
  );
}
