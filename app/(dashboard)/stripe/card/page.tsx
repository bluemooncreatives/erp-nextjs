// `stripe.index` - the card page StripeController@index rendered, with the
// publishable key from `payment_gateways` row 1.

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { GatewayId, findGateway } from '@/lib/payment/gateways';
import { singlePrice } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { StripeCardForm } from './card-form';

export const metadata: Metadata = { title: 'Card Payment' };

export default async function StripeCardPage({
  searchParams,
}: {
  searchParams: Promise<{ sale_id?: string; amount?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const gateway = await findGateway(GatewayId.Stripe);
  const amount = Number(sp.amount ?? 0);
  const saleId = Number(sp.sale_id ?? 0);

  return (
    <>
      <PageHeader
        title="Card Payment"
        breadcrumb={[{ label: 'My Details' }, { label: 'Payment' }]}
      />
      <StripeCardForm
        publishableKey={gateway?.gatewayApiKey ?? ''}
        saleId={saleId}
        amount={amount}
        amountLabel={await singlePrice(amount)}
      />
    </>
  );
}
