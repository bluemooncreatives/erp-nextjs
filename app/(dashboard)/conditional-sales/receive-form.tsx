'use client';

// The "Order Receive" modal of `sale::conditional_sale.index`
// (SaleController@saleOrder), inline: who took delivery and when.

import { useActionState, useState } from 'react';
import { FormInput } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { receiveSaleOrder, type ReceiveOrderState } from './actions';

const INITIAL: ReceiveOrderState = {};

export function ReceiveOrderForm({ saleId }: { saleId: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(receiveSaleOrder, INITIAL);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-theme-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
      >
        Receive
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={saleId} />
      <FormInput
        label="Received By"
        name="name"
        required
        wrapperClassName="w-40"
        error={state.fieldErrors?.name}
      />
      <FormInput
        label="Delivery Date"
        name="delivery_date"
        type="date"
        required
        wrapperClassName="w-44"
        error={state.fieldErrors?.delivery_date}
      />
      <SubmitButton>Save</SubmitButton>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mb-0.5 rounded-lg px-2 py-1 text-theme-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
      >
        Cancel
      </button>
    </form>
  );
}
