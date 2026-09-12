// Add product - port of ProductController@index, which rendered
// `product::product.add_product`.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import {
  allVariantsWithValues,
  productFormOptions,
} from '@/lib/product/repositories';
import { productsForPurchase } from '@/lib/product/products';
import { PageHeader } from '@/components/erp/page';
import { ProductForm } from './product-form';
import { storeProduct } from '../product-actions';

export const metadata: Metadata = { title: 'Add Product' };

export default async function AddProductPage() {
  await authorize('add_product.index');

  const [options, variantRows, skuRows] = await Promise.all([
    productFormOptions(),
    allVariantsWithValues(),
    productsForPurchase(),
  ]);

  return (
    <>
      <PageHeader
        title="Add Product"
        breadcrumb={[{ label: 'Products' }, { label: 'Add Product' }]}
      />
      <ProductForm
        heading="Product Information"
        action={storeProduct}
        options={{
          brands: options.brands.map((b) => ({ value: b.id, label: b.name })),
          models: options.models.map((m) => ({ value: m.id, label: m.name })),
          unitTypes: options.unitTypes.map((u) => ({ value: u.id, label: u.name })),
          categories: options.categories.map((c) => ({ value: c.id, label: c.name })),
          subCategories: options.subCategories.map((c) => ({
            value: c.id,
            label: c.name,
            parentId: c.parentId,
          })),
          variants: variantRows.map((v) => ({
            id: v.id,
            name: v.name,
            values: v.values.map((x) => ({ id: x.id, value: x.value })),
          })),
          skus: skuRows.map((s) => ({
            id: s.id,
            label: `${s.productName ?? ''} (${s.sku ?? s.id})`,
          })),
        }}
      />
    </>
  );
}
