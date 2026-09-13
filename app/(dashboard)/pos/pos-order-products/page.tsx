// Add sale - port of SaleController@create (`sale::sale.create`).

import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { comboProducts, taxes, partNumbers, productSku } from '@/lib/db/schema';
import { customerOptions } from '@/lib/contact/queries';
import { productsWithStock } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import { PageHeader } from '@/components/erp/page';
import { SaleForm, type SellableProduct } from '../../sale/sale-form';
import { checkoutPos } from '../actions';

export const metadata: Metadata = { title: 'POS' };

export default async function PosPage() {
  const user = await authorize('sale.store');
  const session = await getSession();
  const setting = await generalSetting();

  const showroomId = session?.showroomId ?? user.showroomId ?? null;

  const [customers, locations, taxRows, accounts, stockProducts, combos] =
    await Promise.all([
      customerOptions(true),
      locationOptions(),
      db.select().from(taxes).where(eq(taxes.status, 1)),
      paymentAccountOptions(),
      showroomId
        ? productsWithStock(showroomId, MorphType.ShowRoom)
        : productsWithStock(),
      db.select().from(comboProducts).where(eq(comboProducts.status, 1)),
    ]);

  const serials = await db.select().from(partNumbers).where(eq(partNumbers.isSold, 0));
  const skuRows = await db.select({ id: productSku.id, barcode: productSku.barcodeId }).from(productSku);
  const products: SellableProduct[] = [
    ...stockProducts.map((p) => ({
      id: p.id,
      barcode: skuRows.find((s) => s.id === p.id)?.barcode,
      serialNumbers: serials.filter((s) => s.productSkuId === p.id).map((s) => ({ id: s.id, label: s.seiralNo ?? String(s.id) })),
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

  return (
    <>
      <PageHeader
        title="POS"
        breadcrumb={[{ label: 'Sale' }, { label: 'POS' }]}
      />
      <SaleForm
        action={checkoutPos}
        pos
        heading="Point of Sale"
        submitLabel="Complete checkout"
        currencySymbol={setting.currencySymbol ?? '$'}
        defaultLocation={showroomId ? `showroom-${showroomId}` : undefined}
        options={{
          customers: customers.map((c) => ({
            value: `customer-${c.id}`,
            label: `${c.name}${c.mobile ? ` (${c.mobile})` : ''}`,
          })),
          locations,
          taxes: taxRows.map((t) => ({
            id: t.id,
            name: t.name,
            rate: Number(t.rate),
          })),
          paymentAccounts: accounts.map((a) => ({
            value: a.id,
            label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
          })),
          products,
        }}
      />
    </>
  );
}
