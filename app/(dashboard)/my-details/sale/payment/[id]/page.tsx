// Pay an invoice - port of ContactController@my_payment
// (`contact::contact.my_details.sale_payment`). The Blade's select swapped the
// form's action between the Stripe card page and the PayPal handoff.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findSale } from '@/lib/sale/queries';
import { singlePrice } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { InvoicePaymentForm } from './payment-form';

export const metadata: Metadata = { title: 'Payment' };

export default async function MyPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const record = await findSale(Number(id));
  if (!record) notFound();

  const { sale, payments } = record;

  // The invoice belongs to the signed-in contact, or it is not theirs to pay.
  if (Number(user.contactId) !== Number(sale.customerId)) notFound();

  const paid = payments.reduce((total, payment) => total + Number(payment.amount), 0);
  const payable = Number(sale.payableAmount) - paid;
  const due = payable < 0 ? 0 : payable;

  return (
    <>
      <PageHeader
        title={`Payment for ${sale.invoiceNo ?? sale.id}`}
        breadcrumb={[{ label: 'My Details' }, { label: 'Payment' }]}
      />
      <InvoicePaymentForm
        saleId={sale.id}
        due={due}
        dueLabel={await singlePrice(due)}
        paidLabel={await singlePrice(paid)}
      />
    </>
  );
}
