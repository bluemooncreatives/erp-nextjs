// Contact profile - port of ContactController@profile
// (`contact::contact.my_details.profile`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { findContact } from '@/lib/contact/queries';
import { countryRepository } from '@/lib/setup/repositories';
import { PageHeader, Card } from '@/components/erp/page';
import { ContactProfileForm } from './form';

export const metadata: Metadata = { title: 'My Profile' };

export default async function ContactProfilePage() {
  const user = await requireUser();

  const contactId = Number(user.contactId);
  const contact = contactId ? await findContact(contactId) : null;
  if (!contact) notFound();

  const countries = await countryRepository.all();

  return (
    <>
      <PageHeader title="My Profile" breadcrumb={[{ label: 'My Details' }, { label: 'Profile' }]} />
      <Card title="Profile">
        <ContactProfileForm
          contact={{
            name: contact.name,
            email: contact.email ?? '',
            mobile: contact.mobile ?? '',
            taxNumber: contact.taxNumber ?? '',
            countryId: contact.countryId ? String(contact.countryId) : '',
            state: contact.state ?? '',
            city: contact.city ?? '',
            address: contact.address ?? '',
            note: contact.note ?? '',
          }}
          countries={countries.map((c) => ({ value: c.id, label: c.name ?? '' }))}
        />
      </Card>
    </>
  );
}
