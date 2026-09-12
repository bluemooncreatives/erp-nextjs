'use client';

// Stock adjustment form - port of `inventory::stock_adjustment.create`.

import { useActionState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { ROUTES } from '@/lib/routes';
import { LinePicker, type PickableProduct } from '../../line-picker';
import { storeStockAdjustment, type InventoryFormState } from '../../actions';

const INITIAL: InventoryFormState = {};

export function AdjustmentForm({
  locations,
  products,
  currencySymbol,
  defaultLocation,
}: {
  locations: SelectOption[];
  products: PickableProduct[];
  currencySymbol: string;
  defaultLocation?: string;
}) {
  const [state, formAction] = useActionState(storeStockAdjustment, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert variant="error" message={state.error} />

      <Card title="Adjustment Details">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="Branch / Warehouse"
            name="warehouse_id"
            required
            placeholder="Select location"
            defaultValue={defaultLocation ?? ''}
            options={locations}
            error={state.fieldErrors?.warehouse_id}
          />
          <FormInput label="Reference No" name="ref_no" />
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            error={state.fieldErrors?.date}
          />
          <FormInput
            label="Recovery Amount"
            name="recovery_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
          />
        </div>
      </Card>

      <Card
        title="Products"
        desc="The quantities entered here are written OFF the location's stock when the adjustment is approved."
      >
        <LinePicker
          products={products}
          idFieldName="product_id"
          quantityFieldName="product_quantity"
          currencySymbol={currencySymbol}
          showPrice={false}
          error={state.fieldErrors?.product_id}
        />
      </Card>

      <Card title="Reason">
        <FormTextarea label="Reason" name="notes" />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['stock_adjustment.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton>Save Adjustment</SubmitButton>
      </div>
    </form>
  );
}
