// Contact detail - port of ContactController@show (`add_contact.show`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findContact } from '@/lib/contact/queries';
import { ContactDetail } from '../../contact-detail';

export const metadata: Metadata = { title: 'Contact Details' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('add_contact.show');
  const { id } = await params;
  const contact = await findContact(Number(id));
  if (!contact) notFound();

  return <ContactDetail contact={contact} variant="supplier" />;
}
