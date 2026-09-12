// Customer detail - port of ContactController@customer_details.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findContact } from '@/lib/contact/queries';
import { ContactDetail } from '../../../contact-detail';

export const metadata: Metadata = { title: 'Customer Details' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await findContact(Number(id));
  if (!contact) notFound();

  return <ContactDetail contact={contact} variant="customer" />;
}
