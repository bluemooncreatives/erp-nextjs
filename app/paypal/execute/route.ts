// `paypal.execute` - completes an approved payment and books it against the
// sale (PaypalController@execute). The PHP kept the sale and amount in the
// session; they travel on the return URL here.

import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { executePaypalPayment, recordGatewayPayment } from '@/lib/payment/gateways';
import { ROUTES } from '@/lib/routes';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const params = request.nextUrl.searchParams;

  const amount = Number(params.get('amount'));
  const saleId = Number(params.get('sale_id'));
  const paymentId = params.get('paymentId') ?? '';
  const payerId = params.get('PayerID') ?? '';

  const done = NextResponse.redirect(new URL(ROUTES['contact.my_details'], request.url));

  if (!paymentId || !payerId || !Number.isFinite(amount) || !Number.isFinite(saleId)) {
    return done;
  }

  try {
    const result = await executePaypalPayment(paymentId, payerId);
    if (result.ok) {
      await recordGatewayPayment(saleId, amount, 'Paypal', user.id);
      await successLog(`PayPal payment recorded for sale ${saleId}`, user.id);
    }
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  return done;
}
