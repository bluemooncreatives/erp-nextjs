// Sales tax - port of the `sale_tax` account report.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { salesTaxReport } from '@/lib/reports/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../report/report-filter';

export const metadata: Metadata = { title: 'Sales Tax' };

export default async function SalesTaxPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await authorize('sale_tax');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total } = await salesTaxReport({ from: sp.from, to: sp.to });

  const taxRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.sale.date) })),
  );

  return (
    <>
      <PageHeader
        title="Sales Tax"
        breadcrumb={[{ label: 'Accounts'}, { label:'Sales Tax' }]}
        actions={
          <ReportFilter action={ROUTES['sale_tax']} from={sp.from} to={sp.to} />
        }
      />

      <Card
        title={`Invoices with tax (${rows.length}) - ${symbol} ${numberFormat(total)} collected`}
        bodyClassName=""
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Customer' },
            { label: 'Net amount' },
            { label: 'Tax' },
            { label: 'Total' },
          ]}
          isEmpty={taxRows.length === 0}
          empty="No taxed invoices in this period."
        >
          {taxRows.map((r) => (
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
              <Td>{`${symbol} ${numberFormat(r.sale.amount)}`}</Td>
              <Td className="font-medium">
                {`${symbol} ${numberFormat(r.sale.totalTax)}`}
              </Td>
              <Td>{`${symbol} ${numberFormat(r.sale.payableAmount)}`}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
