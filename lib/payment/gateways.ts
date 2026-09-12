// ---------------------------------------------------------------------------
// Online payment gateways - port of Modules/Stripe and Modules/Paypal.
//
// Both controllers took their credentials from a fixed `payment_gateways` row
// (Stripe is 1, PayPal is 2), charged the customer, and then recorded a bank
// payment against the sale through `SaleRepository::payments()`. The PHP SDKs
// are replaced here by direct calls to the same REST APIs.
// ---------------------------------------------------------------------------

import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { chartAccounts, paymentGateways, type PaymentGatewaysRow } from '@/lib/db/schema';
import { defaultCurrency } from '@/lib/settings';
import { recordSalePayments } from '@/lib/sale/repository';

/** `PaymentGateway::findOrFail(1|2)` */
export const GatewayId = { Stripe: 1, Paypal: 2 } as const;

/** The chart accounts each gateway's receipts were banked into. */
export const GatewayAccountCode = { Stripe: '03-30', Paypal: '03-31' } as const;

export async function findGateway(id: number): Promise<PaymentGatewaysRow | null> {
  const [row] = await db
    .select()
    .from(paymentGateways)
    .where(eq(paymentGateways.id, id))
    .limit(1);
  return row ?? null;
}

async function gatewayAccountId(code: string): Promise<number | null> {
  const [row] = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(eq(chartAccounts.code, code))
    .limit(1);
  return row?.id ?? null;
}

/**
 * The shared tail of both controllers: a bank payment named after the gateway,
 * booked against the sale.
 */
export async function recordGatewayPayment(
  saleId: number,
  amount: number,
  gateway: 'Stripe' | 'Paypal',
  userId: number,
): Promise<void> {
  const accountId = await gatewayAccountId(GatewayAccountCode[gateway]);

  await recordSalePayments(
    saleId,
    [
      {
        paymentMethod: 'bank',
        amount,
        accountId,
        bankName: gateway,
        branch: gateway,
      },
    ],
    userId,
  );
}

async function currencyCode(): Promise<string> {
  const currency = await defaultCurrency();
  return (currency?.code ?? 'USD').toLowerCase();
}

// --- Stripe ----------------------------------------------------------------

/**
 * `Stripe\Charge::create()` - the amount is sent in the currency's minor unit,
 * exactly as the PHP multiplied by 100.
 */
export async function createStripeCharge(options: {
  token: string;
  amount: number;
  userId: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const gateway = await findGateway(GatewayId.Stripe);
  if (!gateway?.gatewaySecretKey) {
    return { ok: false, message: 'Stripe is not configured.' };
  }

  const body = new URLSearchParams({
    amount: String(Math.round(options.amount * 100)),
    currency: await currencyCode(),
    source: options.token,
    description: 'Stripe Paymant',
    'metadata[order_id]': crypto.randomUUID(),
    'metadata[user_id]': String(options.userId),
  });

  const response = await fetch('https://api.stripe.com/v1/charges', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gateway.gatewaySecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return { ok: false, message: payload?.error?.message ?? 'Something went wrong!' };
  }

  return { ok: true };
}

// --- PayPal ----------------------------------------------------------------

function paypalBase(gateway: PaymentGatewaysRow): string {
  return gateway.gatewayMode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalToken(gateway: PaymentGatewaysRow): Promise<string | null> {
  const credentials = Buffer.from(
    `${gateway.gatewayApiKey ?? ''}:${gateway.gatewaySecretKey ?? ''}`,
  ).toString('base64');

  const response = await fetch(`${paypalBase(gateway)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

/**
 * `PaypalController@process` - creates the payment and returns the approval
 * link the customer is sent to. The return and cancel URLs keep the PHP's
 * `{redirect_url}/paypal/execute` and `/paypal/cancel` shape; the sale and
 * amount the PHP kept in the session ride along as query parameters, which
 * PayPal preserves when it appends `paymentId` and `PayerID`.
 */
export async function createPaypalPayment(
  amount: number,
  saleId: number,
): Promise<{ ok: true; approvalUrl: string } | { ok: false; message: string }> {
  const gateway = await findGateway(GatewayId.Paypal);
  if (!gateway?.gatewayApiKey || !gateway.gatewaySecretKey) {
    return { ok: false, message: 'PayPal is not configured.' };
  }

  const token = await paypalToken(gateway);
  if (!token) return { ok: false, message: 'PayPal rejected the credentials.' };

  const currency = (await defaultCurrency())?.code ?? 'USD';
  const total = String(Math.trunc(amount));
  const redirect = (gateway.redirectUrl ?? '').replace(/\/+$/, '');

  const response = await fetch(`${paypalBase(gateway)}/v1/payments/payment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'sale',
      payer: { payment_method: 'paypal' },
      redirect_urls: {
        return_url: `${redirect}/paypal/execute?sale_id=${saleId}&amount=${amount}`,
        cancel_url: `${redirect}/paypal/cancel`,
      },
      transactions: [
        {
          amount: {
            currency,
            total,
            details: { subtotal: total, shipping: '0', tax: '0' },
          },
          description: 'Payment description',
          invoice_number: crypto.randomUUID(),
          item_list: {
            items: [
              {
                name: 'PayPal payment',
                currency,
                quantity: 1,
                sku: '123123',
                price: total,
              },
            ],
          },
        },
      ],
    }),
  });

  if (!response.ok) return { ok: false, message: 'Something went wrong!' };

  const payload = (await response.json()) as {
    links?: Array<{ rel: string; href: string }>;
  };
  const approval = payload.links?.find((link) => link.rel === 'approval_url');
  if (!approval) return { ok: false, message: 'Something went wrong!' };

  return { ok: true, approvalUrl: approval.href };
}

/** `PaypalController@execute` - completes an approved payment. */
export async function executePaypalPayment(
  paymentId: string,
  payerId: string,
): Promise<{ ok: boolean }> {
  const gateway = await findGateway(GatewayId.Paypal);
  if (!gateway) return { ok: false };

  const token = await paypalToken(gateway);
  if (!token) return { ok: false };

  const response = await fetch(
    `${paypalBase(gateway)}/v1/payments/payment/${encodeURIComponent(paymentId)}/execute`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payer_id: payerId }),
    },
  );

  return { ok: response.ok };
}
