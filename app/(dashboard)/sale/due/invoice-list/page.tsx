// `due.invoice.list` - SaleController@invoiceList, `sale::sale.index`.
//
// `dueInvoiceList()` reads `session('customer')`, which the sale and POS forms
// set over AJAX when a customer is picked, and lists that party's unpaid
// invoices - `type != 2 and status != 1`, by `agent_user_id` when the session
// value is prefixed `agent-` and by `customer_id` otherwise.
//
// A session value set by one screen and read by another has no equivalent
// here, so the party travels on the query string in the PHP's own
// `<prefix>-<id>` spelling. With nothing selected the PHP returned an empty
// list, and so does this.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { dueInvoiceList } from '@/lib/sale/queries';
import { customerOptions } from '@/lib/contact/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { FormSelect } from '@/components/erp/fields';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/common/link-button';
import { Banknote, FileText, Filter, Wallet, X } from 'lucide-react';
import { ReportSummary } from '@/components/erp/report-summary';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Due Invoice List' };

export default async function DueInvoiceListPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  await authorize('due.invoice.list');
  const sp = await searchParams;

  // `explode('-', $user)` - "agent-7" reads as the agent, anything else as the
  // customer.
  const [prefix, rawId] = (sp.customer ?? '').split('-');
  const partyId = Number(rawId) || null;
  const asAgent = prefix === 'agent';

  const [setting, customers] = await Promise.all([generalSetting(), customerOptions()]);
  const symbol = setting.currencySymbol ?? '$';

  const invoices = partyId ? await dueInvoiceList({ id: partyId, asAgent }) : [];

  const rows = await Promise.all(
    invoices.map(async (sale) => ({
      ...sale,
      dateLabel: await dateConvert(sale.date),
      dueAmount: Number(sale.payableAmount) - sale.paidAmount,
    })),
  );

  const invoicedTotal = rows.reduce((sum, row) => sum + Number(row.payableAmount ?? 0), 0);
  const paidTotal = rows.reduce((sum, row) => sum + Number(row.paidAmount ?? 0), 0);

  const canShow = await can('sale.show');
  const action = ROUTES['due.invoice.list'];

  return (
    <>
      <PageHeader
        title="Due Invoice List"
        breadcrumb={[{ label: 'Sale' }, { label: 'Due Invoice List' }]}
      />

      <Card title="Customer" desc="Pick the party whose unpaid invoices you want.">
        <form action={action} method="get" className="flex flex-wrap items-end gap-3">
          <FormSelect
            name="customer"
            label="Customer"
            defaultValue={sp.customer ?? ''}
            placeholder="Select customer"
            options={customers.map((c) => ({
              value: `customer-${c.id}`,
              label: c.businessName ? `${c.name} (${c.businessName})` : c.name,
            }))}
            wrapperClassName="min-w-64 flex-1"
          />
          <Button type="submit" variant="soft">
            <Filter />
            Show invoices
          </Button>
          {sp.customer ? (
            <LinkButton href={action} variant="ghost">
              <X />
              <Phrase>Clear</Phrase>
            </LinkButton>
          ) : null}
        </form>
      </Card>

      <div className="mt-5">
        {partyId ? (
          <>
          <ReportSummary
            figures={[
              { label: 'Unpaid invoices', value: rows.length, detail: 'For this party', icon: FileText },
              {
                label: 'Invoiced',
                value: `${symbol} ${numberFormat(invoicedTotal)}`,
                detail: 'Total billed',
                icon: Banknote,
              },
              {
                label: 'Still owing',
                value: `${symbol} ${numberFormat(invoicedTotal - paidTotal)}`,
                detail: `${symbol} ${numberFormat(paidTotal)} already paid`,
                icon: Wallet,
              },
            ]}
          />

          <Card title="Unpaid invoices" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Invoice' },
                { label: 'Date' },
                { label: 'Branch' },
                { label: 'Total' },
                { label: 'Paid' },
                { label: 'Due' },
              ]}
              isEmpty={rows.length === 0}
              empty="Nothing is outstanding for this customer."
            >
              {rows.map((sale) => (
                <Tr key={sale.id}>
                  <Td>
                    {canShow ? (
                      <Link
                        href={route('sale.show', { id: sale.id })}
                        className="font-medium text-primary hover:text-primary"
                      >
                        {sale.invoiceNo ?? sale.id}
                      </Link>
                    ) : (
                      <span className="font-medium">{sale.invoiceNo ?? sale.id}</span>
                    )}
                  </Td>
                  <Td>{sale.dateLabel}</Td>
                  <Td>{sale.locationName ?? '-'}</Td>
                  <Td>{`${symbol} ${numberFormat(sale.payableAmount)}`}</Td>
                  <Td>{`${symbol} ${numberFormat(sale.paidAmount)}`}</Td>
                  <Td>{`${symbol} ${numberFormat(sale.dueAmount)}`}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
          </>
        ) : (
          <EmptyState message="Select a customer to list their unpaid invoices." />
        )}
      </div>
    </>
  );
}
