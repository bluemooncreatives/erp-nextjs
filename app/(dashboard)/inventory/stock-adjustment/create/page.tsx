// Add stock adjustment - port of StockAdjustmentController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { productsWithStock } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { generalSetting } from '@/lib/settings';
import { MorphType } from '@/lib/db/morph';
import { PageHeader } from '@/components/erp/page';
import { AdjustmentForm } from './adjustment-form';

export const metadata: Metadata = { title: 'Add Stock Adjustment' };

export default async function CreateStockAdjustmentPage() {
  const user = await authorize('stock_adjustment.store');
  const session = await getSession();
  const setting = await generalSetting();
  const showroomId = session?.showroomId ?? user.showroomId ?? null;

  const [locations, stockProducts] = await Promise.all([
    locationOptions(),
    showroomId
      ? productsWithStock(showroomId, MorphType.ShowRoom)
      : productsWithStock(),
  ]);

  return (
    <>
      <PageHeader
        title="Add Stock Adjustment"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Stock Adjustment' }]}
      />
      <AdjustmentForm
        locations={locations}
        currencySymbol={setting.currencySymbol ?? '$'}
        defaultLocation={showroomId ? `showroom-${showroomId}` : undefined}
        products={stockProducts.map((p) => ({
          id: p.id,
          label: `${p.productName ?? ''} (${p.sku ?? p.id})`,
          price: Number(p.purchasePrice),
          stock: Number(p.stock) || 0,
        }))}
      />
    </>
  );
}
