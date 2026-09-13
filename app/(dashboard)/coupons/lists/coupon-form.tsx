'use client';

// The "Add Coupon" modal of `product::coupons.index`, as an inline card.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeCoupon, type CouponFormState } from './actions';
import { Phrase } from '@/context/TranslationContext';

const INITIAL: CouponFormState = {};

const TYPES = [
  { value: 1, label: 'Active' },
  { value: 2, label: 'Expired' },
];

export function CouponForm() {
  const [state, formAction] = useActionState(storeCoupon, INITIAL);

  return (
    <Card title="Add Coupon">
      <form action={formAction} className="space-y-5">
        <FormAlert message={state.error} />
        <FormAlert message={state.success} variant="success" />

        <FormInput label="Code" name="code" required error={state.fieldErrors?.code} />
        <FormSelect
          label="Discount Type"
          name="discount_type"
          required
          options={TYPES}
          error={state.fieldErrors?.discount_type}
        />
        <FormInput
          label="Date From"
          name="start_date"
          type="date"
          required
          error={state.fieldErrors?.start_date}
        />
        <FormInput
          label="Date Till"
          name="end_date"
          type="date"
          required
          error={state.fieldErrors?.end_date}
        />
        <FormInput label="Cause" name="cause" />
        <FormSelect
          label="Status"
          name="status"
          options={TYPES}
          error={state.fieldErrors?.status}
        />

        <SubmitButton><Phrase>Save</Phrase></SubmitButton>
      </form>
    </Card>
  );
}
