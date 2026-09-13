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
import { parseLocation } from '@/lib/inventory/stock';
import { SubmitButton } from '@/components/erp/submit-button';
import { PageHeader } from '@/components/erp/page';
import { SaleForm, type SellableProduct } from '../../sale/sale-form';
import { checkoutPos } from '../actions';

export const metadata: Metadata = { title: 'POS' };

export default async function PosPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const user = await authorize('sale.store');
  const session = await getSession();
  const setting = await generalSetting();

  const showroomId = session?.showroomId ?? user.showroomId ?? null;

  const locations = await locationOptions();
  const query = await searchParams;
  const requested = query.location ?? (showroomId ? `showroom-${showroomId}` : String(locations[0]?.value ?? ''));
  const selected = locations.find((l) => String(l.value) === requested) ?? locations[0];
  const locationRef = String(selected?.value ?? '');
  const location = parseLocation(locationRef);
  const [customers, taxRows, accounts, stockProducts, combos] =
    await Promise.all([
      customerOptions(true),
      db.select().from(taxes).where(eq(taxes.status, 1)),
      paymentAccountOptions(),
      location ? productsWithStock(location.id, location.type) : Promise.resolve([]),
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
      <form method="get" className="mb-5 flex items-end gap-3">
        <label className="text-sm">Stock location<select name="location" defaultValue={locationRef} className="ms-2 rounded border border-border bg-background p-2">{locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
        <SubmitButton size="sm">Load location</SubmitButton>
      </form>
      <SaleForm
        key={locationRef}
        action={checkoutPos}
        pos
        heading="Point of Sale"
        submitLabel="Complete checkout"
        currencySymbol={setting.currencySymbol ?? '$'}
        defaultLocation={locationRef}
        options={{
          customers: customers.map((c) => ({
            value: `customer-${c.id}`,
            label: `${c.name}${c.mobile ? ` (${c.mobile})` : ''}`,
          })),
          locations: selected ? [selected] : [],
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
