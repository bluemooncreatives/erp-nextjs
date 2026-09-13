// Add quotation - port of QuotationController@create.

import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { taxes, comboProducts } from '@/lib/db/schema';
import { customerOptions } from '@/lib/contact/queries';
import { productsForPurchase } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { generalSetting } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { QuotationForm } from './quotation-form';

export const metadata: Metadata = { title: 'Add Quotation' };

export default async function CreateQuotationPage() {
  const user = await authorize('quotation.store');
  const session = await getSession();
  const setting = await generalSetting();
  const showroomId = session?.showroomId ?? user.showroomId ?? null;

  const [customers, locations, taxRows, skus, combos] = await Promise.all([
    customerOptions(true),
    locationOptions(),
    db.select().from(taxes).where(eq(taxes.status, 1)),
    productsForPurchase(),
    db.select().from(comboProducts).where(eq(comboProducts.status, 1)),
  ]);

  return (
    <>
      <PageHeader
        title="Add Quotation"
        breadcrumb={[{ label: 'Quotation' }, { label: 'Add Quotation' }]}
      />
      <QuotationForm
        currencySymbol={setting.currencySymbol ?? '$'}
        defaultLocation={showroomId ? `showroom-${showroomId}` : undefined}
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
      />
    </>
  );
}
