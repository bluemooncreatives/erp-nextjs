// Convert a quotation to a sale - port of QuotationController@convertToSale
// (`quotation::quotation.clone_to_sale`).
//
// The Blade rendered the sale form pre-filled from the quotation and posted it
// to `sale.store`: the quotation is left untouched and a new invoice is written
// from its customer, location and lines.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findQuotation } from '@/lib/quotation/repository';
import { MorphType } from '@/lib/db/morph';
import { today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { SaleForm } from '../../../sale/sale-form';
import { loadSaleFormData, locationRefOf } from '../../../sale/sale-form-data';
import { storeSale } from '../../../sale/actions';

export const metadata: Metadata = { title: 'Convert Quotation to Sale' };

export default async function ConvertQuotationToSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The conversion writes a sale, so the sale permission is what gates it.
  await authorize('sale.store');
  const { id } = await params;

  const record = await findQuotation(Number(id));
  if (!record) notFound();

  const { quotation, items } = record;
  const isWarehouse = quotation.quotationableType === MorphType.WareHouse;

  // `productList($quotationable_id, $quotationable_type)`, falling back to
  // branch 1 when the quotation has no location - as the PHP did.
  const { options, currencySymbol, stockByKey } = await loadSaleFormData({
    locationId: quotation.quotationableId ?? 1,
    locationType: isWarehouse ? MorphType.WareHouse : MorphType.ShowRoom,
  });

  const source = quotation.invoiceNo ?? `Quotation #${quotation.id}`;

  return (
    <>
      <PageHeader
        title="Convert to Sale"
        breadcrumb={[
          { label: 'Quotation' },
          { label: source },
          { label: 'Convert to Sale' },
        ]}
      />
      <SaleForm
        action={storeSale}
        quotationId={quotation.id}
        heading={`New sale from ${source}`}
        submitLabel="Save Sale"
        currencySymbol={currencySymbol}
        options={options}
        defaults={{
          // No `id`: the quotation is not edited, a sale is created.
          customerRef: quotation.customerId ? `customer-${quotation.customerId}` : '',
          locationRef: locationRefOf(
            quotation.quotationableType,
            quotation.quotationableId,
          ),
          date: today(),
          refNo: quotation.refNo ?? '',
          invoiceNo: '',
          notes: quotation.notes ?? '',
          discountType: String(quotation.discountType ?? 1),
          discountValue: Number(quotation.discountAmount ?? 0),
          taxId: '0',
          shippingCharge: Number(quotation.shippingCharge ?? 0),
          otherCharge: Number(quotation.otherCharge ?? 0),
          lines: items.map((item) => {
            const isCombo = item.productableType === MorphType.ComboProduct;
            const productId = isCombo
              ? (item.productableId ?? item.productSkuId)
              : item.productSkuId;
            return {
              productId,
              isCombo,
              label: item.name ?? String(productId),
              price: Number(item.price),
              quantity: item.quantity,
              tax: Number(item.tax ?? 0),
              discount: Number(item.discount ?? 0),
              // A quotation reserves nothing, so the line's ceiling is whatever
              // is on hand now - which is also why a quotation can convert to a
              // sale the stock cannot cover, and the action refuses it.
              stock: stockByKey.get(`${isCombo ? 'c' : 'p'}-${productId}`)?.stock ?? 0,
            };
          }),
        }}
      />
    </>
  );
}
