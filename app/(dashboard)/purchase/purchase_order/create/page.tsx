// Add purchase order - port of PurchaseOrderController@create.

import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { cNFs, taxes } from '@/lib/db/schema';
import { supplierOptions } from '@/lib/contact/queries';
import { productsForPurchase } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { PurchaseForm } from '../../purchase-form';
import { storePurchaseOrder } from '../../actions';

export const metadata: Metadata = { title: 'Add Purchase Order' };

export default async function CreatePurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string | string[]; supplier_id?: string }>;
}) {
  const user = await authorize('purchase_order.store');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const showroomId = session?.showroomId ?? user.showroomId ?? null;

  const [suppliers, locations, taxRows, accounts, skus, agents] = await Promise.all([
    supplierOptions(),
    locationOptions(),
    db.select().from(taxes).where(eq(taxes.status, 1)),
    paymentAccountOptions(),
    productsForPurchase(),
    db.select().from(cNFs),
  ]);

  // `convertSuggest()` - the Stock Alert List hands the chosen SKUs over to
  // this form, prefilled but still a new order.
  const selectedSkus = (Array.isArray(sp.sku) ? sp.sku : sp.sku ? [sp.sku] : [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);

  const suggested = selectedSkus.length
    ? skus.filter((p) => selectedSkus.includes(p.id))
    : [];

  const defaults =
    suggested.length || sp.supplier_id
      ? {
          supplierId: sp.supplier_id ?? '',
          locationRef: showroomId ? `showroom-${showroomId}` : '',
          date: today(),
          refNo: '',
          lcNo: '',
          cnfId: '',
          shippingAddress: '',
          notes: '',
          discountType: '2',
          discountValue: 0,
          taxId: '0',
          shippingCharge: 0,
          otherCharge: 0,
          lines: suggested.map((p) => ({
            productId: p.id,
            label: `${p.productName ?? ''} (${p.sku ?? p.id})`,
            price: Number(p.purchasePrice),
            sellingPrice: Number(p.sellingPrice),
            quantity: 1,
            tax: Number(p.tax),
            discount: 0,
          })),
        }
      : undefined;

  return (
    <>
      <PageHeader
        title="Add Purchase Order"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Add Purchase Order' }]}
      />
      <PurchaseForm
        action={storePurchaseOrder}
        defaults={defaults}
        currencySymbol={setting.currencySymbol ?? '$'}
        defaultLocation={showroomId ? `showroom-${showroomId}` : undefined}
        options={{
          suppliers: suppliers.map((s) => ({
            value: s.id,
            label: `${s.name}${s.businessName ? ` - ${s.businessName}` : ''}`,
          })),
          locations,
          taxes: taxRows.map((t) => ({ id: t.id, name: t.name, rate: Number(t.rate) })),
          paymentAccounts: accounts.map((a) => ({
            value: a.id,
            label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
          })),
          cnfAgents: agents.map((a) => ({
            value: a.id,
            label: a.name ?? `Agent ${a.id}`,
          })),
          products: skus.map((p) => ({
            id: p.id,
            label: `${p.productName ?? ''} (${p.sku ?? p.id})`,
            purchasePrice: Number(p.purchasePrice),
            sellingPrice: Number(p.sellingPrice),
            tax: Number(p.tax),
          })),
        }}
      />
    </>
  );
}
