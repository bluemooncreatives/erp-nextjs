// Customer list - port of ContactController@customer.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { ContactType } from '@/lib/contact/queries';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ContactList } from '../contact-list';

export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('customer');
  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="Customer"
        breadcrumb={[{ label: 'Contacts'}, { label:'Customer' }]}
        actions={
          <Link
            href={`${ROUTES['add_contact.create']}?type=Customer`}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
          >
            Add Customer
          </Link>
        }
      />
      <ContactList
        title="Customers"
        baseUrl={ROUTES['customer']}
        filters={{
          search: sp.search,
          page: Number(sp.page ?? 1),
          type: ContactType.Customer,
        }}
        searchParams={sp}
        detailRoute="customer.view"
      />
    </>
  );
}
