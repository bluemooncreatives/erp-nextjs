// Edit sale - port of SaleController@edit (`sale::sale.edit`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { comboProducts, taxes } from '@/lib/db/schema';
import { customerOptions } from '@/lib/contact/queries';
import { findSale } from '@/lib/sale/queries';
import { productsWithStock } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import { PageHeader } from '@/components/erp/page';
import { SaleForm, type SellableProduct } from '../../../sale-form';
import { saveSale } from '../../../actions';

export const metadata: Metadata = { title: 'Edit Sale' };

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('sale.edit');
  const { id } = await params;

  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, items } = record;
  const setting = await generalSetting();

  const isWarehouse = sale.saleableType === MorphType.WareHouse;
  const locationRef = sale.saleableId
    ? `${isWarehouse ? 'warehouse' : 'showroom'}-${sale.saleableId}`
    : '';

  const [customers, locations, taxRows, accounts, stockProducts, combos] =
    await Promise.all([
      customerOptions(true),
      locationOptions(),
      db.select().from(taxes).where(eq(taxes.status, 1)),
      paymentAccountOptions(),
      sale.saleableId
        ? productsWithStock(sale.saleableId, isWarehouse ? MorphType.WareHouse : MorphType.ShowRoom)
        : productsWithStock(),
      db.select().from(comboProducts).where(eq(comboProducts.status, 1)),
    ]);

  const products: SellableProduct[] = [
    ...stockProducts.map((p) => ({
      id: p.id,
      label: `${p.productName ?? ''} (${p.sku ?? p.id})`,
      sellingPrice: Number(p.sellingPrice),
      minSellingPrice: Number(p.minSellingPrice),
      tax: Number(p.tax),
      stock: Number(p.stock) || 0,
    })),
    ...combos.map((c) => ({
      id: c.id,
      label: `${c.name ?? 'Combo'} (combo)`,
      sellingPrice: Number(c.price),
      minSellingPrice: Number(c.minSellingPrice),
      tax: 0,
      stock: 0,
      isCombo: true,
    })),
  ];

  const stockById = new Map(products.map((p) => [`${p.isCombo ? 'c' : 'p'}-${p.id}`, p]));

  return (
    <>
      <PageHeader
        title="Edit Sale"
        breadcrumb={[{ label: 'Sale' }, { label: sale.invoiceNo ?? String(sale.id) }]}
      />
      <SaleForm
        action={saveSale}
        heading={`Edit ${sale.invoiceNo ?? `Sale #${sale.id}`}`}
        submitLabel="Update Sale"
        currencySymbol={setting.currencySymbol ?? '$'}
        options={{
          customers: customers.map((c) => ({
            value: `customer-${c.id}`,
            label: `${c.name}${c.mobile ? ` (${c.mobile})` : ''}`,
          })),
          locations,
          taxes: taxRows.map((t) => ({ id: t.id, name: t.name, rate: Number(t.rate) })),
          paymentAccounts: accounts.map((a) => ({
            value: a.id,
            label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
          })),
          products,
        }}
        defaults={{
          id: sale.id,
          customerRef: sale.customerId
            ? `customer-${sale.customerId}`
            : sale.agentUserId
              ? `agent-${sale.agentUserId}`
              : '',
          locationRef,
          date: sale.date ?? '',
          refNo: sale.refNo ?? '',
          invoiceNo: sale.invoiceNo ?? '',
          notes: sale.notes ?? '',
          // `discount_type` 1 is a fixed amount, 2 a percentage.
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
            const key = `${isCombo ? 'c' : 'p'}-${productId}`;
            return {
              productId,
              isCombo,
              label: item.name ?? String(productId),
              price: Number(item.price),
              quantity: item.quantity,
              tax: Number(item.tax ?? 0),
              discount: Number(item.discount ?? 0),
              // Stock still on hand, plus what this sale already holds.
              stock: (stockById.get(key)?.stock ?? 0) + item.quantity,
            };
          }),
        }}
      />
    </>
  );
}
