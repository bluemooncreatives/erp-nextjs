// Add contact - port of ContactController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { countries } from '@/lib/db/schema';
import { generalSetting } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { ContactForm } from '../../contact-form';
import { storeContact } from '../../actions';

export const metadata: Metadata = { title: 'Add Contact' };

export default async function AddContactPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await authorize('add_contact.store');
  const sp = await searchParams;
  const setting = await generalSetting();

  const countryRows = await db
    .select({ id: countries.id, name: countries.name })
    .from(countries)
    .orderBy(countries.name);

  const lockType =
    sp.type === 'Customer' || sp.type === 'Supplier' ? sp.type : undefined;

  return (
    <>
      <PageHeader
        title="Add Contact"
        breadcrumb={[{ label: 'Contacts' }, { label: 'Add Contact' }]}
      />
      <ContactForm
        heading="Contact Information"
        action={storeContact}
        lockType={lockType}
        defaults={{ contactType: lockType ?? 'Customer' }}
        contactLoginEnabled={Boolean(setting.contactLogin)}
        countries={countryRows.map((c) => ({ value: c.id, label: c.name ?? '' }))}
      />
    </>
  );
}
