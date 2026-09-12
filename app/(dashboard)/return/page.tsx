// Contact returns - port of ContactController@return
// (`contact::contact.my_details.customer_return` / `.supplier_return`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import {
  ContactType,
  customerReturns,
  findContact,
  supplierReturns,
} from '@/lib/contact/queries';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata: Metadata = { title: 'My Returns' };

export default async function ContactReturnPage() {
  const user = await requireUser();

  const contactId = Number(user.contactId);
  const contact = contactId ? await findContact(contactId) : null;
  if (!contact) notFound();

  const isCustomer = contact.contactType === ContactType.Customer;
  const history = isCustomer
    ? await customerReturns(contact.id)
    : await supplierReturns(contact.id);

  const rows = await Promise.all(
    history.map(async (row) => ({
      id: row.id,
      invoiceNo: 'invoiceNo' in row ? row.invoiceNo : null,
      refNo: 'refNo' in row ? row.refNo : null,
      amountLabel: await singlePrice(row.amount ?? 0),
      dateLabel: await dateConvert(row.date),
    })),
  );

  // The Blade summed `$sale->amount` across the returned invoices.
  const total = history.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const totalLabel = await singlePrice(total);

  return (
    <>
      <PageHeader
        title={isCustomer ? 'Customer Return':'Supplier Return'}
        breadcrumb={[{ label: 'My Details'}, { label:'Returns' }]}
      />

      <Card title={`Returns (${rows.length}) - ${totalLabel}`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Reference No' },
            { label: 'Amount' },
          ]}
          isEmpty={rows.length === 0}
          empty="No returns."
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                {row.invoiceNo ?? row.id}
              </Td>
              <Td>{row.refNo ?? '-'}</Td>
              <Td>{row.amountLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
