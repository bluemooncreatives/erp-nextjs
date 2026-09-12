// Supplier list - port of ContactController@supplier.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { ContactType } from '@/lib/contact/queries';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ContactList } from '../contact-list';

export const metadata: Metadata = { title: 'Supplier' };

export default async function SupplierPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('supplier');
  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="Supplier"
        breadcrumb={[{ label: 'Contacts' }, { label: 'Supplier' }]}
        actions={
          <Link
            href={`${ROUTES['add_contact.create']}?type=Supplier`}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Add Supplier
          </Link>
        }
      />
      <ContactList
        title="Suppliers"
        baseUrl={ROUTES['supplier']}
        filters={{
          search: sp.search,
          page: Number(sp.page ?? 1),
          type: ContactType.Supplier,
        }}
        searchParams={sp}
        detailRoute="supplier.view"
      />
    </>
  );
}
