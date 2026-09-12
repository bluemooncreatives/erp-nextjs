// Contact transactions - port of ContactController@transaction and the
// `contact::contact.debit_transaction_list_table` partial it rendered.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { ContactType, contactStatement, findContact } from '@/lib/contact/queries';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata: Metadata = { title: 'My Transactions' };

export default async function ContactTransactionPage() {
  const user = await requireUser();

  const contactId = Number(user.contactId);
  const contact = contactId ? await findContact(contactId) : null;
  if (!contact) notFound();

  const isCustomer = contact.contactType === ContactType.Customer;
  const statement = await contactStatement(contact);

  const openingLabel = await singlePrice(statement.opening);
  const closingLabel = await singlePrice(statement.closing);

  const rows = await Promise.all(
    statement.rows.map(async (row) => ({
      ...row,
      dateLabel: await dateConvert(row.date),
      debitLabel: row.type === 'Dr' ? await singlePrice(row.amount) : '',
      creditLabel: row.type === 'Cr' ? await singlePrice(row.amount) : '',
      balanceLabel: await singlePrice(row.balance),
    })),
  );

  return (
    <>
      <PageHeader
        title={isCustomer ? 'Customer Transaction' : 'Supplier Transaction'}
        breadcrumb={[{ label: 'My Details' }, { label: 'Transactions' }]}
      />

      <Card title={`Transactions (${rows.length}) - balance ${closingLabel}`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice No' },
            { label: 'Description' },
            { label: 'Debit' },
            { label: 'Credit' },
            { label: 'Balance' },
          ]}
          isEmpty={false}
        >
          <Tr>
            <Td className="font-medium text-gray-700 dark:text-gray-300">Openning Balance</Td>
            <Td />
            <Td />
            <Td />
            <Td />
            <Td className="text-right">{openingLabel}</Td>
          </Tr>

          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td>{row.invoiceNo ?? ''}</Td>
              <Td>{row.narration ?? ''}</Td>
              <Td>{row.debitLabel}</Td>
              <Td>{row.creditLabel}</Td>
              <Td className="text-right">{row.balanceLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
