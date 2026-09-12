'use client';

// ---------------------------------------------------------------------------
// Product form - port of product::product.add_product / edit_product.
//
// The fields shown depend on `product_type`, exactly as the Blade view's
// jQuery did:
//   Single    - SKU, purchase/selling/min price, alert quantity
//   Variable  - a row per variant combination
//   Service   - hourly rate instead of prices, no stock fields
//   Combo     - a picker of existing SKUs with quantities
// ---------------------------------------------------------------------------

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  FormCheckbox,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { ROUTES } from '@/lib/routes';
import { ProductType } from '@/lib/product/constants';
import type { ProductFormState } from '../product-actions';

const INITIAL: ProductFormState = {};

export type ProductFormOptions = {
  brands: SelectOption[];
  models: SelectOption[];
  unitTypes: SelectOption[];
  categories: SelectOption[];
  subCategories: Array<SelectOption & { parentId: number | null }>;
  variants: Array<{ id: number; name: string; values: Array<{ id: number; value: string }> }>;
  skus: Array<{ id: number; label: string }>;
};

export type ProductFormDefaults = {
  id?: number;
  productName?: string;
  productType?: string;
  modelId?: number | null;
  unitTypeId?: number | null;
  brandId?: number | null;
  categoryId?: number | null;
  subCategoryId?: number | null;
  origin?: string | null;
  description?: string | null;
  barcodeType?: string | null;
  manageStock?: number;
  alertQuantity?: string | null;
  sku?: string | null;
  purchasePrice?: number;
  sellingPrice?: number;
  minSellingPrice?: number;
  tax?: number;
  taxType?: string | null;
  imageSource?: string | null;
};

const BARCODE_TYPES: SelectOption[] = [
  { value: 'C128', label: 'Code 128 (C128)' },
  { value: 'C39', label: 'Code 39 (C39)' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'UPCA', label: 'UPC-A' },
];

export function ProductForm({
  options,
  defaults = {},
  action,
  heading,
}: {
  options: ProductFormOptions;
  defaults?: ProductFormDefaults;
  action: (
    prev: ProductFormState,
    formData: FormData,
  ) => Promise<ProductFormState>;
  heading: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const [productType, setProductType] = useState(
    defaults.productType ?? ProductType.Single,
  );
  const [categoryId, setCategoryId] = useState<string>(
    defaults.categoryId != null ? String(defaults.categoryId) : '',
  );

  const subCategoryOptions = options.subCategories.filter(
    (s) => String(s.parentId ?? '') === categoryId,
  );

  const isService = productType === ProductType.Service;
  const isVariable = productType === ProductType.Variable;
  const isCombo = productType === ProductType.Combo;

  return (
    <form action={formAction} className="space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <FormAlert variant="error" message={state.error} />

      <Card title={heading}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FormInput
            label="Product Name"
            name="product_name"
            required
            defaultValue={defaults.productName ?? ''}
            error={state.fieldErrors?.product_name}
          />

          <FormSelect
            label="Product Type"
            name="product_type"
            required
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            options={[
              { value: ProductType.Single, label: 'Single' },
              { value: ProductType.Variable, label: 'Variable' },
              { value: ProductType.Service, label: 'Service' },
              { value: ProductType.Combo, label: 'Combo' },
            ]}
            error={state.fieldErrors?.product_type}
          />

          <FormSelect
            label="Brand"
            name="brand_id"
            placeholder="Select brand"
            defaultValue={defaults.brandId != null ? String(defaults.brandId) : ''}
            options={options.brands}
          />

          <FormSelect
            label="Category"
            name="category_id"
            placeholder="Select category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={options.categories}
          />

          <FormSelect
            label="Sub Category"
            name="sub_category_id"
            placeholder="Select sub category"
            defaultValue={
              defaults.subCategoryId != null ? String(defaults.subCategoryId) : ''
            }
            options={subCategoryOptions}
          />

          <FormSelect
            label="Model"
            name="model_id"
            placeholder="Select model"
            defaultValue={defaults.modelId != null ? String(defaults.modelId) : ''}
            options={options.models}
          />

          <FormSelect
            label="Unit Type"
            name="unit_type_id"
            placeholder="Select unit"
            defaultValue={defaults.unitTypeId != null ? String(defaults.unitTypeId) : ''}
            options={options.unitTypes}
          />

          <FormInput label="Origin" name="origin" defaultValue={defaults.origin ?? ''} />

          <FormSelect
            label="Barcode Type"
            name="barcode_type"
            placeholder="Select barcode type"
            defaultValue={defaults.barcodeType ?? 'C128'}
            options={BARCODE_TYPES}
          />

          <FormInput
            label="Product Image"
            name="file"
            type="file"
            accept="image/*"
            hint={defaults.imageSource ? 'Leave empty to keep the current image.' : undefined}
          />

          <FormTextarea
            label="Description"
            name="product_description"
            defaultValue={defaults.description ?? ''}
            wrapperClassName="md:col-span-2 lg:col-span-3"
          />
        </div>
      </Card>

      {isCombo ? (
        <ComboSection skus={options.skus} />
      ) : isVariable ? (
        <VariableSection variants={options.variants} />
      ) : (
        <SingleSection isService={isService} defaults={defaults} />
      )}

      <Card title="Tax">
        <div className="grid gap-5 md:grid-cols-3">
          <FormInput
            label="Tax (%)"
            name="tax"
            type="number"
            step="0.01"
            min="0"
            defaultValue={String(defaults.tax ?? 0)}
          />
          <FormSelect
            label="Tax Type"
            name="tax_type"
            defaultValue={defaults.taxType ?? 'percent'}
            options={[
              { value: 'percent', label: 'Percent' },
              { value: 'fixed', label: 'Fixed' },
            ]}
          />
          {!isService && !isCombo ? (
            <div className="flex items-end pb-3">
              <FormCheckbox
                label="Manage stock"
                name="manage_stock"
                value="1"
                defaultChecked={defaults.manageStock === 1}
              />
            </div>
          ) : null}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['add_product.create']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton>{defaults.id ? 'Update Product' : 'Save Product'}</SubmitButton>
      </div>
    </form>
  );
}

function SingleSection({
  isService,
  defaults,
}: {
  isService: boolean;
  defaults: ProductFormDefaults;
}) {
  return (
    <Card title={isService ? 'Service Pricing' : 'Pricing & Stock'}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <FormInput
          label="SKU"
          name="product_sku"
          defaultValue={defaults.sku ?? ''}
          hint="Leave empty to generate from the product name."
        />

        {isService ? (
          <FormInput
            label="Hourly Rate"
            name="hourly_rate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={String(defaults.sellingPrice ?? 0)}
          />
        ) : (
          <>
            <FormInput
              label="Purchase Price"
              name="purchase_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(defaults.purchasePrice ?? 0)}
            />
            <FormInput
              label="Selling Price"
              name="selling_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(defaults.sellingPrice ?? 0)}
            />
            <FormInput
              label="Min Selling Price"
              name="min_selling_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(defaults.minSellingPrice ?? 0)}
            />
            <FormInput
              label="Alert Quantity"
              name="alert_quantity"
              type="number"
              min="0"
              defaultValue={defaults.alertQuantity ?? '0'}
            />
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * Variable products: pick the variants in play, then fill one row per
 * combination. The rows are posted as the flat parallel arrays the PHP chunked.
 */
function VariableSection({
  variants,
}: {
  variants: ProductFormOptions['variants'];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [rows, setRows] = useState<Array<{ valueIds: number[] }>>([]);

  const chosen = variants.filter((v) => selected.includes(v.id));

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
    setRows([]);
  };

  return (
    <Card
      title="Variations"
      desc="Choose the variants this product varies by, then add one row per combination."
    >
      <div className="flex flex-wrap gap-4">
        {variants.map((variant) => (
          <label
            key={variant.id}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
          >
            <input
              type="checkbox"
              checked={selected.includes(variant.id)}
              onChange={() => toggle(variant.id)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {variant.name}
            {selected.includes(variant.id) ? (
              <input type="hidden" name="selected_variant" value={variant.id} />
            ) : null}
          </label>
        ))}
      </div>

      {chosen.length > 0 ? (
        <>
          <div className="mt-5 space-y-4">
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="grid gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-2 lg:grid-cols-4 dark:border-gray-700"
              >
                {chosen.map((variant, i) => (
                  <div key={variant.id}>
                    <input type="hidden" name="variation_type" value={variant.id} />
                    <FormSelect
                      label={variant.name}
                      name="variation_value_id"
                      required
                      placeholder={`Select ${variant.name}`}
                      defaultValue={
                        row.valueIds[i] != null ? String(row.valueIds[i]) : ''
                      }
                      options={variant.values.map((v) => ({
                        value: v.id,
                        label: v.value,
                      }))}
                    />
                  </div>
                ))}

                <FormInput label="SKU" name="variation_sku" />
                <FormInput
                  label="Purchase Price"
                  name="purchase_prices"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
                <FormInput
                  label="Selling Price"
                  name="selling_prices"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
                <FormInput
                  label="Min Selling Price"
                  name="min_selling_prices"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
                <FormInput
                  label="Alert Quantity"
                  name="alert_quantities"
                  type="number"
                  min="0"
                  defaultValue="0"
                />

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== rowIndex))}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { valueIds: [] }])}
            className="mt-4 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            Add combination
          </button>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Select at least one variant to define combinations.
        </p>
      )}
    </Card>
  );
}

/** Combo products bundle existing SKUs with a quantity each. */
function ComboSection({ skus }: { skus: Array<{ id: number; label: string }> }) {
  const [rows, setRows] = useState<number[]>([0]);

  return (
    <Card title="Combo Items" desc="Pick the products bundled into this combo.">
      <div className="space-y-4">
        {rows.map((key, index) => (
          <div key={key} className="grid gap-4 md:grid-cols-3">
            <FormSelect
              label="Product"
              name="selected_product_id"
              required
              placeholder="Select product"
              options={skus.map((s) => ({ value: s.id, label: s.label }))}
              wrapperClassName="md:col-span-2"
            />
            <div className="flex gap-2">
              <FormInput
                label="Quantity"
                name="selected_product_qty"
                type="number"
                min="1"
                defaultValue="1"
                wrapperClassName="flex-1"
              />
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  className="mb-0.5 self-end rounded-lg px-3 py-2.5 text-sm font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, Date.now()])}
        className="mt-4 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
      >
        Add item
      </button>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <FormInput
          label="Combo Selling Price"
          name="combo_selling_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
        />
        <FormInput
          label="Total Purchase Price"
          name="purchase_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
        />
        <FormInput
          label="Total Regular Price"
          name="selling_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
        />
        <FormInput
          label="Min Selling Price"
          name="min_selling_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
        />
      </div>
    </Card>
  );
}
