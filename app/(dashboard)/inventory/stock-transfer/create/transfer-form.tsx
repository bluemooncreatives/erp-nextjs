'use client';

// Stock transfer form - port of `inventory::stock_transfer.create`.

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
import { LinePicker, type PickableProduct, type PickedLine } from '../../line-picker';
import { storeStockTransfer, updateTransferAction, type InventoryFormState } from '../../actions';

const INITIAL: InventoryFormState = {};

export function TransferForm({
  locations,
  products,
  currencySymbol,
  defaultFrom,
  defaults,
}: {
  locations: SelectOption[];
  products: PickableProduct[];
  currencySymbol: string;
  defaultFrom?: string;
  defaults?: { id: number; to: string; date: string; notes: string; lines: PickedLine[] };
}) {
  const [state, formAction] = useActionState(defaults ? updateTransferAction : storeStockTransfer, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <FormAlert variant="error" message={state.error} />

      <Card title="Transfer Details">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="From"
            name="from"
            required
            placeholder="Sending location"
            defaultValue={defaultFrom ?? ''}
            options={locations}
            error={state.fieldErrors?.from}
          />
          <FormSelect
            label="To"
            name="to"
            required
            placeholder="Receiving location"
            defaultValue={defaults?.to}
            options={locations}
            error={state.fieldErrors?.to}
          />
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
            error={state.fieldErrors?.date}
          />
          <FormInput label="Documents" name="documents" type="file" multiple />
        </div>
      </Card>

      <Card title="Products">
        <LinePicker
          products={products}
          initialLines={defaults?.lines}
          idFieldName="product_id"
          quantityFieldName="quantity"
          priceFieldName="product_price"
          currencySymbol={currencySymbol}
          error={state.fieldErrors?.product_id}
        />
      </Card>

      <Card title="Notes">
        <FormTextarea label="Notes" name="notes" defaultValue={defaults?.notes} />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['stock-transfer.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton>Save Transfer</SubmitButton>
      </div>
    </form>
  );
}
