// Convert a sale to a quotation - port of SaleController@convertToQuotation
// (`sale::sale.clone_quotation`).
//
// Despite the route's name (`sale.convertTosale`), the PHP renders the
// *quotation* form pre-filled from a sale and posts it to `quotation.store`.
// The customer list here is `witoutWalkInCustomer()`: a quotation is addressed
// to someone, so the walk-in placeholder is not offered.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { taxes } from '@/lib/db/schema';
import { customerOptions } from '@/lib/contact/queries';
import { findSale } from '@/lib/sale/queries';
import { productsForPurchase } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import { today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { QuotationForm } from '../../../quotation/quotation/create/quotation-form';

export const metadata: Metadata = { title: 'Convert Sale to Quotation' };

export default async function ConvertSaleToQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // It writes a quotation, so that is the permission that applies.
  await authorize('quotation.store');
  const { id } = await params;

  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, items } = record;
  const setting = await generalSetting();
  const isWarehouse = sale.saleableType === MorphType.WareHouse;

  const [customers, locations, taxRows, skus] = await Promise.all([
    customerOptions(false),
    locationOptions(),
    db.select().from(taxes).where(eq(taxes.status, 1)),
    productsForPurchase(),
  ]);

  const source = sale.invoiceNo ?? `Sale #${sale.id}`;

  return (
    <>
      <PageHeader
        title="Convert to Quotation"
        breadcrumb={[
          { label: 'Sale' },
          { label: source },
          { label: 'Convert to Quotation' },
        ]}
      />
      <QuotationForm
        submitLabel="Save Quotation"
        currencySymbol={setting.currencySymbol ?? '$'}
        customers={customers.map((customer) => ({
          value: customer.id,
          label: `${customer.name}${customer.mobile ? ` (${customer.mobile})` : ''}`,
        }))}
        locations={locations}
        taxes={taxRows.map((tax) => ({
          id: tax.id,
          name: tax.name,
          rate: Number(tax.rate),
        }))}
        products={skus.map((sku) => ({
          id: sku.id,
          label: `${sku.productName ?? ''} (${sku.sku ?? sku.id})`,
          sellingPrice: Number(sku.sellingPrice),
          tax: Number(sku.tax),
        }))}
        defaults={{
          // No `id`: this stores a new quotation rather than editing the sale.
          customerId: sale.customerId ? String(sale.customerId) : '',
          locationRef: sale.saleableId
            ? `${isWarehouse ? 'warehouse' : 'showroom'}-${sale.saleableId}`
            : '',
          date: today(),
          // A quotation needs a validity date; the sale has none to carry over.
          validTillDate: '',
          refNo: sale.refNo ?? '',
          shippingAddress: '',
          notes: sale.notes ?? '',
          discountType: String(sale.discountType ?? 1),
          discountValue: Number(sale.discountAmount ?? 0),
          taxId: '0',
          shippingCharge: Number(sale.shippingCharge ?? 0),
          otherCharge: Number(sale.otherCharge ?? 0),
          // The quotation form has no combo picker, so combo lines cannot carry
          // across; the PHP's picker had the same product list.
          lines: items
            .filter((item) => item.productableType !== MorphType.ComboProduct)
            .map((item) => ({
              productId: item.productSkuId,
              label: item.name ?? String(item.productSkuId),
              price: Number(item.price),
              quantity: item.quantity,
              tax: Number(item.tax ?? 0),
              discount: Number(item.discount ?? 0),
            })),
        }}
      />
    </>
  );
}
