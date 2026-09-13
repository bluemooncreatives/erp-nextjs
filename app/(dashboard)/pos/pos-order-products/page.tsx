// Add sale - port of SaleController@create (`sale::sale.create`).

import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { comboProducts, taxes, partNumbers, productSku } from '@/lib/db/schema';
import { customerOptions, WALK_IN_CUSTOMER_ID } from '@/lib/contact/queries';
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

  // A branch-scoped user gets no picker at all - matching the PHP header,
  // which renders a regular_user's showroom name read-only rather than a
  // <select>. `checkoutPos` refuses any other location server-side too.
  const allLocations = await locationOptions();
  const locations = user.isSystemUser
    ? allLocations
    : allLocations.filter((l) => l.value === `showroom-${showroomId}`);
  const query = await searchParams;
  const requested = user.isSystemUser
    ? (query.location ?? (showroomId ? `showroom-${showroomId}` : String(locations[0]?.value ?? '')))
    : `showroom-${showroomId}`;
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

  // The walk-in customer is pre-selected so the cashier can check out without
  // picking a party on every anonymous transaction. Falls back to the first
  // active customer if the seeded walk-in (id=1) is not in this install.
  const walkInCustomerRef = customers.some((c) => c.id === WALK_IN_CUSTOMER_ID)
    ? `customer-${WALK_IN_CUSTOMER_ID}`
    : (customers[0] ? `customer-${customers[0].id}` : '');

  return (
    <>
      <PageHeader
        title="POS"
        breadcrumb={[{ label: 'Sale' }, { label: 'POS' }]}
      />
      {user.isSystemUser ? (
        <form method="get" className="mb-5 flex items-end gap-3">
          <label className="text-sm">Stock location<select name="location" defaultValue={locationRef} className="ms-2 rounded border border-border bg-background p-2">{locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
          <SubmitButton size="sm">Load location</SubmitButton>
        </form>
      ) : (
        <p className="mb-5 text-sm text-muted-foreground">Stock location: {selected?.label ?? 'None assigned'}</p>
      )}
      <SaleForm
        key={locationRef}
        action={checkoutPos}
        pos
        heading="Point of Sale"
        submitLabel="Complete checkout"
        currencySymbol={setting.currencySymbol ?? '$'}
        defaultLocation={locationRef}
        defaults={{
          customerRef: walkInCustomerRef,
          locationRef,
          date: new Date().toISOString().slice(0, 10),
          refNo: '',
          notes: '',
          discountType: '1',
          discountValue: 0,
          taxId: '0',
          shippingCharge: 0,
          otherCharge: 0,
          lines: [],
        }}
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
