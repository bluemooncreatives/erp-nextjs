// Edit contact - port of ContactController@edit.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { countries } from '@/lib/db/schema';
import { findContact } from '@/lib/contact/queries';
import { generalSetting } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { ContactForm } from '../../../contact-form';
import { updateContactAction } from '../../../actions';

export const metadata: Metadata = { title: 'Edit Contact' };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('add_contact.edit');
  const { id } = await params;

  const contact = await findContact(Number(id));
  if (!contact) notFound();

  const setting = await generalSetting();
  const countryRows = await db
    .select({ id: countries.id, name: countries.name })
    .from(countries)
    .orderBy(countries.name);

  return (
    <>
      <PageHeader
        title="Edit Contact"
        breadcrumb={[{ label: 'Contacts' }, { label: 'Edit Contact' }]}
      />
      <ContactForm
        heading="Contact Information"
        action={updateContactAction}
        contactLoginEnabled={Boolean(setting.contactLogin)}
        countries={countryRows.map((c) => ({ value: c.id, label: c.name ?? '' }))}
        defaults={{
          id: contact.id,
          contactType: contact.contactType,
          name: contact.name,
          businessName: contact.businessName,
          taxNumber: contact.taxNumber,
          openingBalance: contact.openingBalance,
          payTerm: contact.payTerm,
          payTermCondition: contact.payTermCondition,
          customerGroup: contact.customerGroup,
          creditLimit: contact.creditLimit,
          email: contact.email,
          username: contact.username,
          mobile: contact.mobile,
          alternateContactNo: contact.alternateContactNo,
          countryId: contact.countryId,
          state: contact.state,
          city: contact.city,
          note: contact.note,
          address: contact.address,
          avatar: contact.avatar,
        }}
      />
    </>
  );
}
