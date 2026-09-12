// `paypal.process` - creates the PayPal payment and sends the customer to the
// approval page (PaypalController@process).

import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/permissions';
import { createPaypalPayment } from '@/lib/payment/gateways';
import { ROUTES } from '@/lib/routes';

export async function POST(request: NextRequest) {
  await requireUser();

  const form = await request.formData();
  const amount = Number(form.get('amount'));
  const saleId = Number(form.get('sale_id'));

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(saleId)) {
    return NextResponse.redirect(new URL(ROUTES['contact.my_details'], request.url));
  }

  const result = await createPaypalPayment(amount, saleId);
  if (!result.ok) {
    return NextResponse.redirect(new URL(ROUTES['contact.my_details'], request.url));
  }

  return NextResponse.redirect(result.approvalUrl);
}
