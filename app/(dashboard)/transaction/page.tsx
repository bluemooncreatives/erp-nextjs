// Contact transactions - port of ContactController@transaction and the
// `contact::contact.debit_transaction_list_table` partial it rendered.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { ContactType, contactStatement, findContact } from '@/lib/contact/queries';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { PlayCircle, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'My Transactions' };

export default async function ContactTransactionPage() {
  const user = await requireUser();

  const contactId = Number(user.contactId);
  const contact = contactId ? await findContact(contactId) : null;
  if (!contact) notFound();

  const isCustomer = contact.contactType === ContactType.Customer;
  const statement = await contactStatement(contact);

  const [openingLabel, closingLabel, debitLabel, creditLabel] = await Promise.all([
    singlePrice(statement.opening),
    singlePrice(statement.closing),
    singlePrice(statement.rows.filter((r) => r.type === 'Dr').reduce((sum, r) => sum + Number(r.amount), 0)),
    singlePrice(statement.rows.filter((r) => r.type === 'Cr').reduce((sum, r) => sum + Number(r.amount), 0)),
  ]);

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
        title={isCustomer ? 'Customer Transaction':'Supplier Transaction'}
        breadcrumb={[{ label: 'My Details'}, { label:'Transactions' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Opening balance', value: openingLabel, detail: 'Brought forward', icon: PlayCircle },
          { label: 'Debits', value: debitLabel, detail: 'Dr on this contact', icon: ArrowDownLeft },
          { label: 'Credits', value: creditLabel, detail: 'Cr on this contact', icon: ArrowUpRight },
          { label: 'Current balance', value: closingLabel, detail: `After ${rows.length} transactions`, icon: Scale },
        ]}
      />

      <Card title={`Transactions (${rows.length})`} bodyClassName="">
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
            <Td className="font-medium text-foreground"><Phrase>Openning Balance</Phrase></Td>
            <Td />
            <Td />
            <Td />
            <Td />
            <Td className="text-end">{openingLabel}</Td>
          </Tr>

          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td>{row.invoiceNo ?? ''}</Td>
              <Td>{row.narration ?? ''}</Td>
              <Td>{row.debitLabel}</Td>
              <Td>{row.creditLabel}</Td>
              <Td className="text-end">{row.balanceLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
