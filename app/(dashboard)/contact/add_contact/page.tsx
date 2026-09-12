import { LinkButton } from '@/components/common/link-button';
// All contacts - port of ContactController@index.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ContactList } from '../contact-list';

export const metadata: Metadata = { title: 'Contacts' };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('add_contact.index');
  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="Contacts"
        breadcrumb={[{ label: 'Contacts' }]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <LinkButton
              href={ROUTES['contact_csv_upload']}
              
            >
              Upload via CSV
            </LinkButton>
            <LinkButton
              href={ROUTES['add_contact.create']}
              
            >
              Add Contact
            </LinkButton>
          </div>
        }
      />
      <ContactList
        title="Contacts"
        baseUrl={ROUTES['add_contact.index']}
        filters={{ search: sp.search, page: Number(sp.page ?? 1) }}
        searchParams={sp}
      />
    </>
  );
}
