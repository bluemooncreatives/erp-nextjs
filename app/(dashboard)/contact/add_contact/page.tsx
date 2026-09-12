// All contacts - port of ContactController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
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
            <Link
              href={ROUTES['contact_csv_upload']}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
            >
              Upload via CSV
            </Link>
            <Link
              href={ROUTES['add_contact.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Contact
            </Link>
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
