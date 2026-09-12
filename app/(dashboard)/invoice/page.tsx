// Contact invoices - port of ContactController@invoice
// (`contact::contact.my_details.customer_invoice` / `.supplier_invoice`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { ContactType, findContact } from '@/lib/contact/queries';
import { customerSaleHistory, supplierPurchaseHistory } from '@/lib/contact/repository';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Receipt, CircleCheck, CircleAlert, Wallet } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'My Invoices' };

export default async function ContactInvoicePage() {
  const user = await requireUser();

  const contactId = Number(user.contactId);
  const contact = contactId ? await findContact(contactId) : null;
  if (!contact) notFound();

  const isCustomer = contact.contactType === ContactType.Customer;
  const history = isCustomer
    ? await customerSaleHistory(contact.id)
    : await supplierPurchaseHistory(contact.id);

  const rows = await Promise.all(
    history.map(async (row) => ({
      id: row.id,
      invoiceNo: 'invoiceNo' in row ? row.invoiceNo : null,
      refNo: 'refNo' in row ? row.refNo : null,
      amountLabel: await singlePrice('payableAmount' in row ? row.payableAmount : 0),
      dateLabel: await dateConvert(row.date),
      status: row.status,
    })),
  );

  // Paid against unpaid is the reason to open a contact's invoice list, so it
  // leads - the raw count alone never answered it.
  const paidCount = history.filter((row) => row.status === 1 || row.status === 2).length;
  const totalLabel = await singlePrice(
    history.reduce((sum, row) => sum + Number('payableAmount' in row ? row.payableAmount : 0), 0),
  );
  const unpaidLabel = await singlePrice(
    history
      .filter((row) => row.status !== 1 && row.status !== 2)
      .reduce((sum, row) => sum + Number('payableAmount' in row ? row.payableAmount : 0), 0),
  );

  return (
    <>
      <PageHeader
        title={isCustomer ? 'Customer Invoice':'Supplier Invoice'}
        breadcrumb={[{ label: 'My Details'}, { label:'Invoices' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Unpaid value', value: unpaidLabel, detail: `${history.length - paidCount} invoices`, icon: CircleAlert },
          { label: 'Paid', value: paidCount, detail: 'Settled invoices', icon: CircleCheck },
          { label: 'Invoiced total', value: totalLabel, detail: 'Across every invoice', icon: Wallet },
          { label: 'Invoices', value: rows.length.toLocaleString('en-US'), detail: 'On this contact', icon: Receipt },
        ]}
      />

      <Card title={`Invoices (${rows.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Reference No' },
            { label: 'Paid Status' },
            { label: 'Amount' },
          ]}
          isEmpty={rows.length === 0}
          empty="No invoices."
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                {row.invoiceNo ?? row.id}
              </Td>
              <Td>{row.refNo ?? '-'}</Td>
              <Td>
                <Badge
                  color={row.status === 1 || row.status === 2 ? 'success' : 'warning'}
                  size="sm"
                >
                  {row.status === 1 || row.status === 2 ? 'Paid':'Unpaid'}
                </Badge>
              </Td>
              <Td>{row.amountLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
