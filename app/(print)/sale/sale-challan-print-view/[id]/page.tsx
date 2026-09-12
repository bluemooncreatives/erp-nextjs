// Delivery challan - port of SaleController@challan_print_view
// (`sale::sale.challan_print_view`), which listed the goods without prices.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findSale } from '@/lib/sale/queries';
import { dateConvert, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';
import {
  PrintHeader,
  PrintMeta,
  PrintLines,
  PrintFooter,
} from '@/components/erp/print-invoice';

export const metadata: Metadata = { title: 'Challan' };

export default async function SaleChallanPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, items, customer, agent, shipping } = record;
  const setting = await generalSetting();
  const dateLabel = await dateConvert(sale.date);

  return (
    <>
      <PrintButton label="Print Challan" />

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
        title="Delivery Challan"
        left={[
          { label: 'Challan No', value: sale.invoiceNo ?? String(sale.id) },
          { label: 'Date', value: dateLabel },
          { label: 'Reference', value: sale.refNo ?? '-' },
        ]}
        right={[
          { label: 'Customer', value: customer?.name ?? agent?.name ?? 'Walk-in Customer' },
          { label: 'Mobile', value: customer?.mobile ?? '-' },
          { label: 'Address', value: customer?.address ?? '-' },
          { label: 'Shipped by', value: shipping?.shippingName ?? '-' },
        ]}
      />

      <PrintLines
        showPrice={false}
        lines={items.map((item) => ({
          name: item.name ?? String(item.productSkuId),
          quantity: item.quantity,
        }))}
      />

      <div className="mt-16 flex justify-between text-sm text-gray-600">
        <div className="w-1/3 border-t border-gray-400 pt-2 text-center">Prepared by</div>
        <div className="w-1/3 border-t border-gray-400 pt-2 text-center">Received by</div>
      </div>

      <PrintFooter terms={setting.termsConditions} />
    </>
  );
}
