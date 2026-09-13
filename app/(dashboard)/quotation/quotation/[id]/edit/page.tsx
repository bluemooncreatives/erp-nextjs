// Edit quotation - port of QuotationController@edit
// (`quotation::quotation.edit`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { taxes, comboProducts } from '@/lib/db/schema';
import { customerOptions } from '@/lib/contact/queries';
import { findQuotation } from '@/lib/quotation/repository';
import { productsForPurchase } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { generalSetting } from '@/lib/settings';
import { toDateString } from '@/lib/php-date';
import { MorphType } from '@/lib/db/morph';
import { PageHeader } from '@/components/erp/page';
import { QuotationForm } from '../../create/quotation-form';

export const metadata: Metadata = { title: 'Edit Quotation' };

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('quotation.edit');
  const { id } = await params;

  const record = await findQuotation(Number(id));
  if (!record) notFound();

  const { quotation, items } = record;
  const setting = await generalSetting();

  const [customers, locations, taxRows, skus, combos] = await Promise.all([
    customerOptions(true),
    locationOptions(),
    db.select().from(taxes).where(eq(taxes.status, 1)),
    productsForPurchase(),
    db.select().from(comboProducts).where(eq(comboProducts.status, 1)),
  ]);

  const isWarehouse = quotation.quotationableType === MorphType.WareHouse;

  return (
    <>
      <PageHeader
        title="Edit Quotation"
        breadcrumb={[
          { label: 'Quotation' },
          { label: quotation.invoiceNo ?? String(quotation.id) },
        ]}
      />
      <QuotationForm
        submitLabel="Update Quotation"
        currencySymbol={setting.currencySymbol ?? '$'}
        customers={customers.map((c) => ({
          value: c.id,
          label: `${c.name}${c.mobile ? ` (${c.mobile})` : ''}`,
        }))}
        locations={locations}
        taxes={taxRows.map((t) => ({ id: t.id, name: t.name, rate: Number(t.rate) }))}
        products={skus.map((p) => ({
          id: p.id,
          label: `${p.productName ?? ''} (${p.sku ?? p.id})`,
          sellingPrice: Number(p.sellingPrice),
          tax: Number(p.tax),
        }))}
        combos={combos.map((c) => ({
          id: c.id,
          label: `${c.name ?? 'Combo'}`,
          sellingPrice: Number(c.price),
        }))}
        defaults={{
          id: quotation.id,
          customerId: quotation.customerId ? String(quotation.customerId) : '',
          locationRef: quotation.quotationableId
            ? `${isWarehouse ? 'warehouse' : 'showroom'}-${quotation.quotationableId}`
            : '',
          // `quotations.date` is a TIMESTAMP in this schema.
          date: toDateString(quotation.date) ?? '',
          validTillDate: quotation.validTillDate ?? '',
          refNo: quotation.refNo ?? '',
          shippingAddress: quotation.shippingAddress ?? '',
          notes: quotation.notes ?? '',
          discountType: String(quotation.discountType ?? 1),
          discountValue: Number(quotation.discountAmount ?? 0),
          taxId: '0',
          shippingCharge: Number(quotation.shippingCharge ?? 0),
          otherCharge: Number(quotation.otherCharge ?? 0),
          lines: items.map((item) => {
            const isCombo = item.productableType === MorphType.ComboProduct;
            // A combo line's own product reference is `productableId`, not
            // `productSkuId` (which the combo item detail row leaves unset).
            const productId = isCombo ? (item.productableId ?? 0) : item.productSkuId;
            return {
              productId,
              isCombo,
              label: item.name ?? String(productId),
              price: Number(item.price),
              quantity: item.quantity,
              tax: Number(item.tax ?? 0),
              discount: Number(item.discount ?? 0),
            };
          }),
        }}
      />
    </>
  );
}
