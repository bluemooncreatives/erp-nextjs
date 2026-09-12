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
import { useLocationProducts } from '../../use-location-products';
import { LinePicker, type PickableProduct, type PickedLine } from '../../line-picker';
import { storeStockAdjustment, updateAdjustmentAction, type InventoryFormState } from '../../actions';

const INITIAL: InventoryFormState = {};

export function AdjustmentForm({
  locations,
  products,
  currencySymbol,
  defaultLocation,
  defaults,
}: {
  locations: SelectOption[];
  products: PickableProduct[];
  currencySymbol: string;
  defaultLocation?: string;
  defaults?: { id: number; refNo: string; date: string; recoveryAmount: number; reason: string; lines: PickedLine[] };
}) {
  const [state, formAction] = useActionState(defaults ? updateAdjustmentAction : storeStockAdjustment, INITIAL);
  const stock = useLocationProducts(products, defaultLocation ?? '', 'adjustment', !!defaults);

  return (
    <form action={formAction} className="space-y-6">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <FormAlert variant="error" message={state.error} />

      <Card title="Adjustment Details">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="Branch / Warehouse"
            name="warehouse_id"
            required
            placeholder="Select location"
            value={stock.location}
            onChange={(event) => stock.setLocation(event.target.value)}
            options={locations}
            error={state.fieldErrors?.warehouse_id}
          />
          <FormInput label="Reference No" name="ref_no" required defaultValue={defaults?.refNo} error={state.fieldErrors?.ref_no} />
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
            error={state.fieldErrors?.date}
          />
          <FormInput
            label="Recovery Amount"
            name="recovery_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults?.recoveryAmount ?? 0}
            required
            error={state.fieldErrors?.recovery_amount}
          />
        </div>
      </Card>

      <Card
        title="Products"
        desc="The quantities entered here are written OFF the location's stock when the adjustment is approved."
      >
        <LinePicker
          products={stock.products}
          initialLines={defaults?.lines}
          idFieldName="product_id"
          quantityFieldName="product_quantity"
          currencySymbol={currencySymbol}
          showPrice={false}
          refreshStock
          error={state.fieldErrors?.product_id}
        />
        {stock.loading && <p className="text-sm text-muted-foreground">Loading stock...</p>}
        <FormAlert variant="error" message={stock.error} />
      </Card>

      <Card title="Reason">
        <FormTextarea label="Reason" name="notes" defaultValue={defaults?.reason} />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['stock_adjustment.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted"
        >
          Cancel
        </Link>
        <SubmitButton>Save Adjustment</SubmitButton>
      </div>
    </form>
  );
}
