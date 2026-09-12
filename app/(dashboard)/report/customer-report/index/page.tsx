// Customer report - port of CustomerReportController@index.

import type { Metadata } from 'next';
import { Banknote, FileText, Receipt, Wallet } from 'lucide-react';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { customerReport } from '@/lib/reports/queries';
import { customerOptions } from '@/lib/contact/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Customer Reports' };

export default async function CustomerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customer_id?: string }>;
}) {
  await authorize('customer_report.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [{ rows, totals, due }, customers] = await Promise.all([
    customerReport({
      from: sp.from,
      to: sp.to,
      customerId: sp.customer_id ? Number(sp.customer_id) : undefined,
    }),
    customerOptions(true),
  ]);

  const saleRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.sale.date) })),
  );

  return (
    <>
      <PageHeader
        title="Customer Reports"
        breadcrumb={[{ label: 'Reports' }, { label: 'Customer Reports' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Invoices', value: numberFormat(rows.length, 0), detail: 'Matching this filter', icon: FileText },
          { label: 'Billed', value: `${symbol} ${numberFormat(totals.payable)}`, detail: 'Total payable', icon: Receipt },
          { label: 'Paid', value: `${symbol} ${numberFormat(totals.paid)}`, detail: 'Received', icon: Wallet },
          { label: 'Due', value: `${symbol} ${numberFormat(due)}`, detail: 'Still owed', icon: Banknote },
        ]}

      />

      <Card
        title="Invoices"
        bodyClassName=""
        actions={
          <ReportFilter
            action={ROUTES['customer_report.index']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'customer_id',
                placeholder: 'All customers',
                value: sp.customer_id,
                options: customers.map((c) => ({ value: c.id, label: c.name })),
              },
            ]}
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Customer' },
            { label: 'Total' },
            { label: 'Paid' },
            { label: 'Due' },
          ]}
          isEmpty={saleRows.length === 0}
          empty="No invoices match this filter."
        >
          {saleRows.map((r) => (
            <Tr key={r.sale.id}>
              <Td>
                <Link
                  href={route('sale.show', { id: r.sale.id })}
                  className="font-medium text-primary hover:text-primary"
                >
                  {r.sale.invoiceNo ?? r.sale.id}
                </Link>
              </Td>
              <Td>{r.dateLabel}</Td>
              <Td>{r.customerName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(r.sale.payableAmount)}`}</Td>
              <Td>{`${symbol} ${numberFormat(r.paidAmount ?? 0)}`}</Td>
              <Td>
                {`${symbol} ${numberFormat(
                  Number(r.sale.payableAmount) - Number(r.paidAmount ?? 0),
                )}`}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
