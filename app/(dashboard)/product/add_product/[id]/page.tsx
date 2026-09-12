// Combo product edit - port of ProductController@show, which rendered
// `product::product.edit_combo_product`. Laravel bound this to both
// `add_product.show` (/product/add_product/{id}) and `add_product.editCombo`
// (/product/combo-edit/{id}); both paths exist here.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findComboProduct } from '@/lib/product/products';
import { PageHeader } from '@/components/erp/page';
import { ComboForm } from '../combo-form';
import { updateProductAction } from '../../product-actions';

export const metadata: Metadata = { title: 'Edit Combo Product' };

export default async function EditComboProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('add_product.show');
  const { id } = await params;

  const found = await findComboProduct(Number(id));
  if (!found) notFound();

  const { combo, details } = found;

  return (
    <>
      <PageHeader
        title="Edit Product"
        breadcrumb={[{ label: 'Products' }, { label: 'Edit Combo Product' }]}
      />
      <ComboForm
        action={updateProductAction}
        defaults={{
          id: combo.id,
          name: combo.name ?? '',
          barcodeType: combo.barcodeType,
          price: combo.price ?? 0,
          totalPurchasePrice: combo.totalPurchasePrice ?? 0,
          totalRegularPrice: combo.totalRegularPrice ?? 0,
          minSellingPrice: combo.minSellingPrice ?? 0,
          description: combo.description,
        }}
        items={details.map((d) => ({
          productSkuId: d.detail.productSkuId ?? 0,
          label: `${d.productName ?? ''} - ${d.sku ?? ''}`,
          quantity: d.detail.productQty ?? 1,
          sellingPrice: d.sellingPrice ?? 0,
          tax: d.tax ?? 0,
        }))}
      />
    </>
  );
}
