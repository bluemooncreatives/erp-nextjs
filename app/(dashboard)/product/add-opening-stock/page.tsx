// Add opening stock - port of ProductController@add_opening_stock_create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { productsForPurchase } from '@/lib/product/products';
import { locationOptions } from '@/lib/setup/repositories';
import { PageHeader } from '@/components/erp/page';
import { OpeningStockForm } from './opening-stock-form';

export const metadata: Metadata = { title: 'Add Opening Stock' };

export default async function OpeningStockPage() {
  const user = await authorize('add_opening_stock_create');
  const session = await getSession();
  const showroomId = session?.showroomId ?? user.showroomId ?? null;

  const [locations, skus] = await Promise.all([
    locationOptions(),
    productsForPurchase(),
  ]);

  return (
    <>
      <PageHeader
        title="Add Opening Stock"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Add Opening Stock' }]}
      />
      <OpeningStockForm
        locations={locations}
        defaultLocation={showroomId ? `showroom-${showroomId}` : undefined}
        products={skus.map((s) => ({
          value: s.id,
          label: `${s.productName ?? ''} (${s.sku ?? s.id})`,
        }))}
      />
    </>
  );
}
