'use client';

// Opening stock form - port of `product::product.add_opening_stock_create`.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeOpeningStock } from '../../purchase/actions';
import type { PurchaseFormState } from '../../purchase/actions';

const INITIAL: PurchaseFormState = {};

export function OpeningStockForm({
  locations,
  products,
  defaultLocation,
}: {
  locations: SelectOption[];
  products: SelectOption[];
  defaultLocation?: string;
}) {
  const [state, formAction] = useActionState(storeOpeningStock, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
      <Card title="Opening Stock">
        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FormSelect
            label="Branch / Warehouse"
            name="showroom"
            required
            placeholder="Select location"
            defaultValue={defaultLocation ?? ''}
            options={locations}
            error={state.fieldErrors?.showroom}
          />
          <FormSelect
            label="Product"
            name="product_sku_id"
            required
            placeholder="Select product"
            options={products}
            error={state.fieldErrors?.product_sku_id}
          />
          <FormInput
            label="Quantity"
            name="stock_quantity"
            type="number"
            min="1"
            required
            defaultValue="1"
          />
          <FormInput
            label="Stock Date"
            name="stock_date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <FormInput
            label="Serial Numbers"
            name="serial_no"
            placeholder="SN1, SN2, ..."
            hint="Comma-separated; leave empty if the product has no serials."
            wrapperClassName="md:col-span-2"
          />
        </div>

        <div className="mt-6">
          <SubmitButton>Add Opening Stock</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
