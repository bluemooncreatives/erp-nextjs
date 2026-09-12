// Sale report - port of SalesReportController@index / search.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { salesReport } from '@/lib/reports/queries';
import { customerOptions } from '@/lib/contact/queries';
import { activeShowRooms } from '@/lib/setup/repositories';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Sale Reports' };

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    customer_id?: string;
    showroom_id?: string;
  }>;
}) {
  const user = await authorize('sales_report.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [{ rows, totals }, customers, showrooms] = await Promise.all([
    salesReport({
      from: sp.from,
      to: sp.to,
      customerId: sp.customer_id ? Number(sp.customer_id) : undefined,
      showroomId: sp.showroom_id
        ? Number(sp.showroom_id)
        : (session?.showroomId ?? user.showroomId),
      allBranches: user.role.type === 'system_user' && !sp.showroom_id,
    }),
    customerOptions(true),
    activeShowRooms(),
  ]);

  const saleRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.sale.date) })),
  );

  return (
    <>
      <PageHeader
        title="Sale Reports"
        breadcrumb={[{ label: 'Reports' }, { label: 'Sale Reports' }]}
      />

      <Card
        title={`Sales (${rows.length}) - ${symbol} ${numberFormat(totals.payable)} billed, ${symbol} ${numberFormat(totals.paid)} collected`}
        bodyClassName=""
        actions={
          <ReportFilter
            action={ROUTES['sales_report.index']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'showroom_id',
                placeholder: 'All branches',
                value: sp.showroom_id,
                options: showrooms.map((s) => ({ value: s.id, label: s.name })),
              },
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
            { label: 'Qty' },
            { label: 'Total' },
            { label: 'Paid' },
            { label: 'Due' },
          ]}
          isEmpty={saleRows.length === 0}
          empty="No sales match this filter."
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
              <Td>{r.customerName ?? r.agentName ?? '-'}</Td>
              <Td>{r.showroomName ?? '-'}</Td>
              <Td>{numberFormat(r.sale.totalQuantity, 0)}</Td>
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
