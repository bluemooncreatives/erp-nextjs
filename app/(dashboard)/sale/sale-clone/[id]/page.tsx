// Clone sale - port of SaleController@cloneSale (`sale::sale.clone_to_sale`).
//
// The Blade rendered the create form pre-filled from an existing invoice and
// posted it to `sale.store`, so the clone is a new sale that happens to start
// with the original's customer, location and lines. The invoice number is left
// blank: the next one is stamped when the new sale is stored.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findSale } from '@/lib/sale/queries';
import { MorphType } from '@/lib/db/morph';
import { today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { SaleForm } from '../../sale-form';
import { loadSaleFormData, locationRefOf } from '../../sale-form-data';
import { storeSale } from '../../actions';

export const metadata: Metadata = { title: 'Clone Sale' };

export default async function CloneSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Cloning writes a new sale, so it is the create permission that applies.
  await authorize('sale.store');
  const { id } = await params;

  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, items } = record;
  const isWarehouse = sale.saleableType === MorphType.WareHouse;

  const { options, currencySymbol, stockByKey } = await loadSaleFormData({
    locationId: sale.saleableId,
    locationType: isWarehouse ? MorphType.WareHouse : MorphType.ShowRoom,
  });

  const source = sale.invoiceNo ?? `Sale #${sale.id}`;

  return (
    <>
      <PageHeader
        title="Clone Sale"
        breadcrumb={[{ label: 'Sale' }, { label: source }, { label: 'Clone' }]}
      />
      <SaleForm
        action={storeSale}
        heading={`New sale from ${source}`}
        submitLabel="Save Sale"
        currencySymbol={currencySymbol}
        options={options}
        defaults={{
          // No `id`: this posts as a new sale, not an edit of the original.
          customerRef: sale.customerId
            ? `customer-${sale.customerId}`
            : sale.agentUserId
              ? `agent-${sale.agentUserId}`
              : '',
          locationRef: locationRefOf(sale.saleableType, sale.saleableId),
          // Today's date, not the original's: this is a new document.
          date: today(),
          refNo: sale.refNo ?? '',
          invoiceNo: '',
          notes: sale.notes ?? '',
          discountType: String(sale.discountType ?? 1),
          discountValue: Number(sale.discountAmount ?? 0),
          taxId: String(sale.taxId ?? 0),
          shippingCharge: Number(sale.shippingCharge ?? 0),
          otherCharge: Number(sale.otherCharge ?? 0),
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
              // The stock actually on hand: unlike an edit, the original sale's
              // quantities are not being released back.
              stock: stockByKey.get(`${isCombo ? 'c' : 'p'}-${productId}`)?.stock ?? 0,
            };
          }),
        }}
      />
    </>
  );
}
