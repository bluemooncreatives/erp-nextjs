import { LinkButton } from '@/components/common/link-button';
// Customer list - port of ContactController@customer.

import type { Metadata } from 'next';
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
          <LinkButton
            href={`${ROUTES['add_contact.create']}?type=Customer`}
            
          >
            Add Customer
          </LinkButton>
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
