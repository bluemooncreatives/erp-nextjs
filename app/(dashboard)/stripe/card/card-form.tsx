'use client';

// The Stripe card form (stripe::index). Stripe.js mounts the card element and
// tokenises it in the browser; only the token reaches the server, as before.

import Script from 'next/script';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert } from '@/components/erp/fields';
import { payWithStripe, type StripeFormState } from './actions';
import { Phrase } from '@/context/TranslationContext';

const INITIAL: StripeFormState = {};

type StripeCardElement = { mount: (selector: string) => void };
type StripeLike = {
  elements: () => { create: (kind: 'card', options?: unknown) => StripeCardElement };
  createToken: (
    card: StripeCardElement,
  ) => Promise<{ token?: { id: string }; error?: { message?: string } }>;
};

declare global {
  interface Window {
    Stripe?: (key: string) => StripeLike;
  }
}

export function StripeCardForm({
  publishableKey,
  saleId,
  amount,
  amountLabel,
}: {
  publishableKey: string;
  saleId: number;
  amount: number;
  amountLabel: string;
}) {
  const [state, formAction] = useActionState(payWithStripe, INITIAL);
  const [ready, setReady] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cardRef = useRef<StripeCardElement | null>(null);
  const stripeRef = useRef<StripeLike | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready || !publishableKey || stripeRef.current || !window.Stripe) return;
    const stripe = window.Stripe(publishableKey);
    const card = stripe.elements().create('card');
    card.mount('#card-element');
    stripeRef.current = stripe;
    cardRef.current = card;
  }, [ready, publishableKey]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Tokenise first; the action only ever sees the token.
    if (tokenRef.current?.value) return;
    event.preventDefault();

    const stripe = stripeRef.current;
    const card = cardRef.current;
    if (!stripe || !card) {
      setCardError('The payment form is still loading.');
      return;
    }

    setSubmitting(true);
    const result = await stripe.createToken(card);
    setSubmitting(false);

    if (result.error || !result.token) {
      setCardError(result.error?.message ?? 'The card could not be verified.');
      return;
    }

    setCardError(null);
    if (tokenRef.current) tokenRef.current.value = result.token.id;
    formRef.current?.requestSubmit();
  }

  return (
    <Card title="Card Payment" desc={`Paying ${amountLabel}`}>
      <Script src="https://js.stripe.com/v3/" onReady={() => setReady(true)} />

      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-5">
        <input type="hidden" name="sale_id" value={saleId} />
        <input type="hidden" name="amount" value={amount} />
        <input ref={tokenRef} type="hidden" name="stripeToken" defaultValue="" />

        <FormAlert message={state.error} />
        <FormAlert message={cardError ?? undefined} />

        {publishableKey ? null : (
          <FormAlert message="Stripe is not configured. Add the keys under Settings - Payment Method." />
        )}

        <div>
          <label
            htmlFor="card-holder-name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            <Phrase>Card Holder Name</Phrase>
          </label>
          <input
            id="card-holder-name"
            name="card-holder-name"
            className="h-11 w-full rounded-lg border border-border bg-transparent px-4 text-sm text-foreground shadow-xs focus:border-ring focus:outline-none"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Card
          </span>
          <div
            id="card-element"
            className="rounded-lg border border-border bg-card px-4 py-3"
          />
        </div>

        <button
          type="submit"
          disabled={!publishableKey || submitting}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Verifying...':'Pay'}
        </button>
      </form>
    </Card>
  );
}
