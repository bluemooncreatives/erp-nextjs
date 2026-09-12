'use server';

// `StripeController@process` - charge the tokenised card, then record the
// payment against the sale and return the customer to their details page.

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { createStripeCharge, recordGatewayPayment } from '@/lib/payment/gateways';
import { findSale } from '@/lib/sale/queries';
import { ROUTES } from '@/lib/routes';
import { actionFormData } from '@/lib/forms';

export type StripeFormState = { error?: string };

export async function payWithStripe(
  _previous: StripeFormState,
  formData: FormData,
): Promise<StripeFormState> {
  formData = actionFormData(_previous, formData);
  const user = await requireUser();

  const token = String(formData.get('stripeToken') ?? '');
  const amount = Number(formData.get('amount'));
  const saleId = Number(formData.get('sale_id'));

  if (!token) return { error: 'The card details could not be read.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount.' };

  const record = await findSale(saleId);
  if (!record) return { error: 'Something went wrong!' };
  // A contact may only pay their own invoice.
  if (user.contactId && Number(user.contactId) !== Number(record.sale.customerId)) {
    return { error: 'Something went wrong!' };
  }

  try {
    const charge = await createStripeCharge({ token, amount, userId: user.id });
    if (!charge.ok) {
      await errorLog(charge.message, user.id);
      return { error: charge.message };
    }

    await recordGatewayPayment(saleId, amount, 'Stripe', user.id);
    await successLog(`Stripe payment recorded for sale ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something went wrong!' };
  }

  redirect(ROUTES['contact.my_details']);
}
