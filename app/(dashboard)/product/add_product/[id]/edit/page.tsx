// Edit product - port of ProductController@edit / `product::product.edit_product`.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import {
  allVariantsWithValues,
  productFormOptions,
} from '@/lib/product/repositories';
import { findProduct, productsForPurchase } from '@/lib/product/products';
import { PageHeader } from '@/components/erp/page';
import { ProductForm } from '../../product-form';
import { updateProductAction } from '../../../product-actions';

export const metadata: Metadata = { title: 'Edit Product' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('add_product.edit');
  const { id } = await params;

  const found = await findProduct(Number(id));
  if (!found) notFound();

  const [options, variantRows, skuRows] = await Promise.all([
    productFormOptions(),
    allVariantsWithValues(),
    productsForPurchase(),
  ]);

  const firstSku = found.skus[0];

  return (
    <>
      <PageHeader
        title="Edit Product"
        breadcrumb={[{ label: 'Products' }, { label: 'Edit Product' }]}
      />
      <ProductForm
        heading="Product Information"
        action={updateProductAction}
        defaults={{
          id: found.product.id,
          productName: found.product.productName ?? '',
          productType: found.product.productType ?? 'Single',
          modelId: found.product.modelId,
          unitTypeId: found.product.unitTypeId,
          brandId: found.product.brandId,
          categoryId: found.product.categoryId,
          subCategoryId: found.product.subCategoryId,
          origin: found.product.origin,
          description: found.product.description,
          barcodeType: found.product.barcodeType,
          manageStock: found.product.manageStock,
          alertQuantity: found.product.alertQuantity,
          imageSource: found.product.imageSource,
          sku: firstSku?.sku ?? null,
          purchasePrice: firstSku?.purchasePrice ?? 0,
          sellingPrice: firstSku?.sellingPrice ?? 0,
          minSellingPrice: firstSku?.minSellingPrice ?? 0,
          tax: firstSku?.tax ?? 0,
          taxType: firstSku?.taxType ?? 'percent',
        }}
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
