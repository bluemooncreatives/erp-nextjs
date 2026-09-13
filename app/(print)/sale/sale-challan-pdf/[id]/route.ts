// `sale.challan_pdf` - SaleController@challanPdf, listing goods without
// prices. dompdf produced a file here; this now does too.

import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findSale } from '@/lib/sale/queries';
import { dateConvert, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { pdfResponse } from '@/lib/pdf/build';
import { invoiceDocument } from '@/lib/pdf/invoice';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, items, customer, agent, shipping } = record;
  const setting = await generalSetting();
  const dateLabel = await dateConvert(sale.date);

  const definition = invoiceDocument({
    title: 'Delivery Challan',
    company: {
      name: setting.companyName ?? setting.siteTitle ?? '',
      phone: setting.phone ?? '',
      email: setting.email ?? '',
      address: setting.address ?? '',
      logoUrl: assetUrl(setting.logo),
    },
    meta: {
      left: [
        { label: 'Challan No', value: sale.invoiceNo ?? String(sale.id) },
        { label: 'Date', value: dateLabel },
        { label: 'Reference', value: sale.refNo ?? '-' },
      ],
      right: [
        { label: 'Customer', value: customer?.name ?? agent?.name ?? 'Walk-in Customer' },
        { label: 'Mobile', value: customer?.mobile ?? '-' },
        { label: 'Address', value: customer?.address ?? '-' },
        { label: 'Shipped by', value: shipping?.shippingName ?? '-' },
      ],
    },
    showPrice: false,
    lines: items.map((item) => ({
      name: item.name ?? String(item.productSkuId),
      quantity: item.quantity,
    })),
    signatures: ['Prepared by', 'Received by'],
    terms: setting.termsConditions,
  });

  return pdfResponse(definition, `Challan-${sale.invoiceNo ?? sale.id}.pdf`);
}
