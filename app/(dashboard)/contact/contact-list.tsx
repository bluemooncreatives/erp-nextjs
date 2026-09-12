// Shared contact listing, used by the Contacts, Customer and Supplier screens
// (contact::contact.index / customer / supplier in the PHP stack).

import Link from 'next/link';
import Image from 'next/image';
import { can } from '@/lib/auth/permissions';
import {
  WALK_IN_CUSTOMER_ID,
  contactAccounts,
  listContacts,
  type ContactListFilters,
} from '@/lib/contact/queries';
import { generalSetting, numberFormat } from '@/lib/settings';
import { avatarUrl } from '@/lib/paths';
import { route } from '@/lib/routes';
import { Card } from '@/components/erp/page';
import { DataTable, Pagination, SearchBar, StatusBadge, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { deleteContactAction, toggleContactActive } from './actions';

export async function ContactList({
  filters,
  baseUrl,
  title,
  searchParams,
  /** Route name of the detail screen the Blade's "View" item linked to. */
  detailRoute = 'add_contact.show',
}: {
  filters: ContactListFilters;
  baseUrl: string;
  title: string;
  searchParams: Record<string, string | undefined>;
  detailRoute?: 'add_contact.show' | 'customer.view' | 'supplier.view';
}) {
  const { rows, total, page, perPage } = await listContacts(filters);
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [canEdit, canDelete] = await Promise.all([
    can('add_contact.edit'),
    can('add_contact.destroy'),
  ]);

  // The list showed each contact's balance; resolve them in parallel.
  const withAccounts = await Promise.all(
    rows.map(async (contact) => ({
      contact,
      accounts: await contactAccounts(contact),
    })),
  );

  return (
    <Card
      title={`${title} (${total})`}
      bodyClassName=""
      actions={
        <SearchBar
          action={baseUrl}
          defaultValue={filters.search}
          placeholder="Search name, email, mobile..."
        />
      }
    >
      <DataTable
        columns={[
          { label: 'Contact' },
          { label: 'Contact ID' },
          { label: 'Mobile' },
          { label: 'Total' },
          { label: 'Paid' },
          { label: 'Due' },
          { label: 'Status' },
          { label: 'Action' },
        ]}
        isEmpty={withAccounts.length === 0}
        empty="No contacts found."
      >
        {withAccounts.map(({ contact, accounts }) => (
          <Tr key={contact.id}>
            <Td>
              <div className="flex items-center gap-3">
                <Image
                  src={avatarUrl(contact.avatar, contact.name)}
                  alt={contact.name}
                  width={36}
                  height={36}
                  className="rounded-full object-cover"
                  unoptimized
                />
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    {contact.name}
                  </p>
                  <p className="text-theme-xs text-gray-400">
                    {contact.businessName ?? contact.email ?? contact.contactType}
                  </p>
                </div>
              </div>
            </Td>
            <Td>{contact.contactId ?? '-'}</Td>
            <Td>{contact.mobile ?? '-'}</Td>
            <Td>{`${symbol} ${numberFormat(accounts.total)}`}</Td>
            <Td>{`${symbol} ${numberFormat(accounts.paid)}`}</Td>
            <Td>{`${symbol} ${numberFormat(accounts.due)}`}</Td>
            <Td>
              {canEdit ? (
                <form action={toggleContactActive}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="is_active" value={contact.isActive} />
                  <ActionButton variant="outline">
                    <StatusBadge status={contact.isActive} />
                  </ActionButton>
                </form>
              ) : (
                <StatusBadge status={contact.isActive} />
              )}
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <Link
                  href={route(detailRoute, { id: contact.id })}
                  className="rounded-lg px-2 py-1 text-theme-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  View
                </Link>
                {/* The customer list hid Edit for the walk-in customer. */}
                {canEdit &&
                (detailRoute !== 'customer.view' || contact.id > WALK_IN_CUSTOMER_ID) ? (
                  <Link
                    href={route('add_contact.edit', { id: contact.id })}
                    className="rounded-lg px-2 py-1 text-theme-xs font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  >
                    Edit
                  </Link>
                ) : null}
                {canDelete ? (
                  <form action={deleteContactAction}>
                    <input type="hidden" name="id" value={contact.id} />
                    <ActionButton confirm={`Delete "${contact.name}"?`}>
                      Delete
                    </ActionButton>
                  </form>
                ) : null}
              </div>
            </Td>
          </Tr>
        ))}
      </DataTable>

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        baseUrl={baseUrl}
        params={searchParams}
      />
    </Card>
  );
}

