'use client';

// ---------------------------------------------------------------------------
// Combo product edit form - port of product::product.edit_combo_product.
//
// The Blade disabled the product picker: an existing combo's member SKUs are
// fixed, and `ProductRepository::update()` only rewrites the quantity of rows
// that already exist. Names, prices and tax are therefore shown read-only and
// only the quantities are editable, as in the source.
// ---------------------------------------------------------------------------

import { useActionState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormTextarea } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { ROUTES } from '@/lib/routes';
import { ProductType } from '@/lib/product/constants';
import type { ProductFormState } from '../product-actions';

const INITIAL: ProductFormState = {};

export type ComboItem = {
  productSkuId: number;
  label: string;
  quantity: number;
  sellingPrice: number;
  tax: number;
};

export function ComboForm({
  action,
  defaults,
  items,
}: {
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  defaults: {
    id: number;
    name: string;
    barcodeType: string | null;
    price: number;
    totalPurchasePrice: number;
    totalRegularPrice: number;
    minSellingPrice: number;
    description: string | null;
  };
  items: ComboItem[];
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={defaults.id} />
      <input type="hidden" name="product_type" value={ProductType.Combo} />

      <FormAlert message={state.error} />

      <Card title="Product Information">
        <div className="grid gap-5 md:grid-cols-3">
          <FormInput
            label="Product Name"
            name="product_name"
            defaultValue={defaults.name}
            error={state.fieldErrors?.product_name}
            required
          />
          <FormInput
            label="Barcode Type"
            name="barcode_type"
            defaultValue={defaults.barcodeType ?? ''}
          />
          <FormInput label="Product Image" name="file" type="file" accept="image/*" />
          <FormInput
            label="Purchase Price"
            name="purchase_price"
            type="number"
            step="0.01"
            defaultValue={String(defaults.totalPurchasePrice)}
          />
          <FormInput
            label="Selling Price"
            name="selling_price"
            type="number"
            step="0.01"
            defaultValue={String(defaults.totalRegularPrice)}
          />
          <FormInput
            label="Min. Selling Price"
            name="min_selling_price"
            type="number"
            step="0.01"
            defaultValue={String(defaults.minSellingPrice)}
          />
          <FormInput
            label="Combo Selling Price"
            name="combo_selling_price"
            type="number"
            step="0.01"
            defaultValue={String(defaults.price)}
          />
        </div>
        <div className="mt-5">
          <FormTextarea
            label="Description"
            name="product_description"
            defaultValue={defaults.description ?? ''}
          />
        </div>
      </Card>

      <Card title="Combo Items" desc="Quantities can be changed; the bundled products cannot.">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.productSkuId} className="grid gap-4 md:grid-cols-12">
              <input type="hidden" name="selected_product_id" value={item.productSkuId} />
              <FormInput
                label="Name"
                name={`item_name_${item.productSkuId}`}
                defaultValue={item.label}
                readOnly
                wrapperClassName="md:col-span-5"
              />
              <FormInput
                label="QTY"
                name="selected_product_qty"
                type="number"
                min="1"
                defaultValue={String(item.quantity)}
                wrapperClassName="md:col-span-3"
              />
              <FormInput
                label="Price"
                name="selected_product_price"
                type="number"
                step="0.01"
                defaultValue={String(item.sellingPrice)}
                readOnly
                wrapperClassName="md:col-span-2"
              />
              <FormInput
                label="Tax"
                name="selected_product_tax"
                type="number"
                step="0.01"
                defaultValue={String(item.tax)}
                readOnly
                wrapperClassName="md:col-span-2"
              />
            </div>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This combo has no items.
            </p>
          ) : null}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton>Update</SubmitButton>
        <Link
          href={ROUTES['add_product.create']}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
