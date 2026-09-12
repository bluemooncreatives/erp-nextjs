import { LinkButton } from '@/components/common/link-button';
// Contact self-service - port of ContactController@my_details
// (`contact::contact.my_details.customer` / `.supplier`).
//
// This is where the dashboard sends a `normal_user`, so it has to stand on its
// own: their balances, their invoices and the links to the rest of the section.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import {
  ContactType,
  contactAccounts,
  contactLastInvoice,
  findContact,
} from '@/lib/contact/queries';
import { customerSaleHistory, supplierPurchaseHistory } from '@/lib/contact/repository';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, DetailList } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'My Details' };

export default async function MyDetailsPage() {
  const user = await requireUser();

  const contactId = Number(user.contactId);
  const contact = contactId ? await findContact(contactId) : null;
  if (!contact) notFound();

  const isCustomer = contact.contactType === ContactType.Customer;

  const [accounts, lastInvoice, history] = await Promise.all([
    contactAccounts(contact),
    isCustomer ? contactLastInvoice(contact.id) : Promise.resolve(null),
    isCustomer
      ? customerSaleHistory(contact.id)
      : supplierPurchaseHistory(contact.id),
  ]);

  const [totalLabel, paidLabel, dueLabel] = await Promise.all([
    singlePrice(accounts.total),
    singlePrice(accounts.paid),
    singlePrice(accounts.due),
  ]);

  const rows = await Promise.all(
    history.slice(0, 10).map(async (row) => ({
      id: row.id,
      invoiceNo: 'invoiceNo' in row ? row.invoiceNo : null,
      amount: await singlePrice(
        'payableAmount' in row ? row.payableAmount : 0,
      ),
      dateLabel: await dateConvert(row.date),
      status: 'status' in row ? row.status : null,
    })),
  );

  return (
    <>
      <PageHeader
        title="My Details"
        breadcrumb={[{ label: isCustomer ? 'Customer' : 'Supplier' }, { label: 'My Details' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {[
              { href: ROUTES['contact.invoice'], label:'Invoices' },
              { href: ROUTES['contact.return'], label:'Returns' },
              { href: ROUTES['contact.transaction'], label:'Transactions' },
              { href: ROUTES['contact.profile'], label:'Profile' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card title={contact.name ?? 'My details'}>
            <DetailList
              items={[
                { label: 'Type', value: contact.contactType ?? '-' },
                { label: 'Email', value: contact.email ?? '-' },
                { label: 'Mobile', value: contact.mobile ?? '-' },
                { label: 'Address', value: contact.address ?? '-' },
                { label: 'City', value: contact.city ?? '-' },
                { label: 'State', value: contact.state ?? '-' },
              ]}
            />
          </Card>

          <Card title="Account Summary">
            <DetailList
              items={[
                { label: 'Total', value: totalLabel },
                { label: 'Paid', value: paidLabel },
                { label: 'Due', value: dueLabel },
                { label: 'Invoices', value: String(accounts.totalInvoice) },
                { label: 'Due invoices', value: String(accounts.dueInvoice) },
              ]}
            />
          </Card>
        </div>

        <Card
          title={isCustomer ? 'Recent invoices':'Recent purchase orders'}
          desc={
            lastInvoice?.invoiceNo ? `Last invoice ${lastInvoice.invoiceNo}` : undefined
          }
          bodyClassName=""
        >
          <DataTable
            columns={[
              { label: 'Date' },
              { label: 'Invoice' },
              { label: 'Amount' },
              { label: 'Status' },
              ...(isCustomer ? [{ label: 'Action' }] : []),
            ]}
            isEmpty={rows.length === 0}
            empty="Nothing here yet."
          >
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>{row.dateLabel}</Td>
                <Td className="font-medium text-foreground">
                  {row.invoiceNo ?? row.id}
                </Td>
                <Td>{row.amount}</Td>
                <Td>
                  <Badge color={row.status === 1 ? 'success' : 'warning'} size="sm">
                    {row.status === 1 ? 'Paid':'Unpaid'}
                  </Badge>
                </Td>
                {isCustomer ? (
                  <Td>
                    {row.status === 1 ? (
                      '-'
                    ) : (
                      <LinkButton
                        href={route('contact.my_payment', { id: row.id })}
                        
                      >
                        Pay
                      </LinkButton>
                    )}
                  </Td>
                ) : null}
              </Tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </>
  );
}
