// Supplier product list - ContactController@supplierPurchaseProductList.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findContact } from '@/lib/contact/queries';
import { ContactProductList } from '../../../contact-product-list';

export const metadata: Metadata = { title: 'Supplier Products' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await findContact(Number(id));
  if (!contact) notFound();

  return (
    <ContactProductList
      contactId={contact.id}
      contactName={contact.name}
      variant="supplier"
    />
  );
}
