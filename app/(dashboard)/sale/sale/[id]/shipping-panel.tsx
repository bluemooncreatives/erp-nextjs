'use client';

// Shipping details - `SaleController@shippingInfo` / `sale.shipping.store`
// (`sale::sale.shipping_info`).
//
// The detail screen could already show shipping, but nothing could record it,
// so the card only ever appeared for rows Laravel had written. The form posts
// the two file fields as well, which is why it is multipart.

import { useActionState } from 'react';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { storeShipping, type SaleFormState } from '../../actions';

const INITIAL: SaleFormState = {};

export function ShippingPanel({
  saleId,
  shipping,
}: {
  saleId: number;
  shipping: {
    id: number;
    shippingName: string | null;
    shippingRef: string | null;
    date: string | null;
    receivedDate: string | null;
    receivedBy: string | null;
  } | null;
}) {
  const [state, formAction] = useActionState(storeShipping, INITIAL);

  return (
    <Card
      title={shipping ? 'Update Shipping' : 'Add Shipping'}
      desc="Carrier, reference and the delivery paperwork."
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="sale_id" value={saleId} />
        {shipping ? <input type="hidden" name="id" value={shipping.id} /> : null}

        <FormAlert variant="error" message={state.error} />
        <FormAlert variant="success" message={state.success} />

        <FormInput
          label="Carrier"
          name="shipping_name"
          defaultValue={shipping?.shippingName ?? ''}
        />
        <FormInput
          label="Reference"
          name="shipping_ref"
          defaultValue={shipping?.shippingRef ?? ''}
        />
        <FormInput
          type="date"
          label="Shipping Date"
          name="shipping_date"
          defaultValue={shipping?.date ?? ''}
        />
        <FormInput
          type="date"
          label="Received Date"
          name="received_date"
          defaultValue={shipping?.receivedDate ?? ''}
        />
        <FormInput
          label="Received By"
          name="received_by"
          defaultValue={shipping?.receivedBy ?? ''}
        />

        {/* `saveUpload` keeps whatever is already stored when the field is
            left empty, so re-saving without re-attaching does not clear it. */}
        <FormInput type="file" label="Booking Slip" name="booking_slip" />
        <FormInput type="file" label="Prove Of Delivery" name="prove_of_delivery" />

        <SubmitButton>{shipping ? 'Update Shipping' : 'Save Shipping'}</SubmitButton>
      </form>
    </Card>
  );
}
