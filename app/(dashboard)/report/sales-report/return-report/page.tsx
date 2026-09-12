// Sales return report - port of SalesReportController@returnReport.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { salesReturnReport } from '@/lib/reports/queries';
import { customerOptions } from '@/lib/contact/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Sales Return' };

export default async function SalesReturnReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customer_id?: string }>;
}) {
  const user = await authorize('sales_return_report.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [{ rows, total }, customers] = await Promise.all([
    salesReturnReport({
      from: sp.from,
      to: sp.to,
      customerId: sp.customer_id ? Number(sp.customer_id) : undefined,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    customerOptions(true),
  ]);

  const returnRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.sale.date) })),
  );

  return (
    <>
      <PageHeader
        title="Sales Return"
        breadcrumb={[{ label: 'Reports' }, { label: 'Sales Return' }]}
      />

      <Card
        title={`Returns (${rows.length}) - ${symbol} ${numberFormat(total)}`}
        bodyClassName=""
        actions={
          <ReportFilter
            action={ROUTES['sales_return_report.index']}
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
            { label: 'Branch' },
            { label: 'Invoice total' },
            { label: 'Returned' },
          ]}
          isEmpty={returnRows.length === 0}
          empty="No returns match this filter."
        >
          {returnRows.map((r) => (
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
              <Td>{r.showroomName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(r.sale.payableAmount)}`}</Td>
              <Td className="font-medium">
                {`${symbol} ${numberFormat(r.returnAmount ?? 0)}`}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
