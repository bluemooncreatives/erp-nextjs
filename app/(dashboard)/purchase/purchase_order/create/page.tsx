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
import { PageHeader } from '@/components/erp/page';
import { PurchaseForm } from '../../purchase-form';
import { storePurchaseOrder } from '../../actions';

export const metadata: Metadata = { title: 'Add Purchase Order' };

export default async function CreatePurchaseOrderPage() {
  const user = await authorize('purchase_order.store');
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

  return (
    <>
      <PageHeader
        title="Add Purchase Order"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Add Purchase Order' }]}
      />
      <PurchaseForm
        action={storePurchaseOrder}
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
