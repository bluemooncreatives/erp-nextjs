// `contact.my_products` - ContactController@my_products.
//
// The signed-in contact's own version of the Products screen: the controller
// takes `auth()->user()->contact_id` and renders the customer or supplier
// product list depending on `contact_type`, which is what `ContactProductList`
// already does for staff looking at someone else's record.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { ContactType, findContact } from '@/lib/contact/queries';
import { ContactProductList } from '../contact/contact-product-list';

export const metadata: Metadata = { title: 'My Products' };

export default async function MyProductsPage() {
  const user = await requireUser();

  const contactId = Number(user.contactId);
  const contact = contactId ? await findContact(contactId) : null;
  if (!contact) notFound();

  return (
    <ContactProductList
      contactId={contact.id}
      contactName={contact.name}
      variant={contact.contactType === ContactType.Customer ? 'customer' : 'supplier'}
    />
  );
}
