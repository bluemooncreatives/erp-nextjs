'use client';

// The amount + gateway chooser. Stripe collects the card on its own page, so
// that branch is a GET to `/stripe/card`; PayPal is a POST that hands off to
// the approval URL, exactly as the Blade's jQuery swapped the form action.

import { useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormInput, FormSelect } from '@/components/erp/fields';
import { ROUTES } from '@/lib/routes';

export function InvoicePaymentForm({
  saleId,
  due,
  dueLabel,
  paidLabel,
}: {
  saleId: number;
  due: number;
  dueLabel: string;
  paidLabel: string;
}) {
  const [method, setMethod] = useState('');
  const isPaypal = method === 'paypal';

  return (
    <Card title="Make a Payment">
      <div className="mb-5 flex flex-wrap gap-8 text-sm">
        <p className="text-muted-foreground">
          Total Paid: <span className="font-medium text-foreground">{paidLabel}</span>
        </p>
        <p className="text-muted-foreground">
          Due: <span className="font-medium text-foreground">{dueLabel}</span>
        </p>
      </div>

      <form
        action={isPaypal ? ROUTES['paypal.process'] : ROUTES['stripe.index']}
        method={isPaypal ? 'POST':'GET'}
        className="space-y-5"
      >
        <input type="hidden" name="sale_id" value={saleId} />

        <div className="grid gap-5 md:grid-cols-2">
          <FormInput
            label="Amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            max={String(due)}
            defaultValue={String(due)}
            required
          />
          <FormSelect
            label="Payment Method"
            name="payment_method"
            required
            placeholder="Select"
            options={[
              { value: 'stripe', label: 'Stripe' },
              { value: 'paypal', label: 'Paypal' },
            ]}
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={!method || due <= 0}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </Card>
  );
}
