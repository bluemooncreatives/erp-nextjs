// Sale history - port of HistoryController@saleHistory / @searchSale
// (`report::history.sale_history`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { saleHistory } from '@/lib/reports/queries';
import { customerOptions } from '@/lib/contact/queries';
import { locationOptions } from '@/lib/setup/repositories';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Wallet, Receipt, Users, Divide } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Sale History' };

export default async function SaleHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    customer_id?: string;
    house_id?: string;
  }>;
}) {
  const user = await authorize('sale.history');
  const sp = await searchParams;
  const session = await getSession();

  const [rows, customers, locations] = await Promise.all([
    saleHistory({
      from: sp.from,
      to: sp.to,
      customerId: sp.customer_id ? Number(sp.customer_id) : undefined,
      locationRef: sp.house_id,
      showroomId: session?.showroomId ?? user.showroomId,
      allBranches: user.role.type === 'system_user',
    }),
    customerOptions(false),
    locationOptions(),
  ]);

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      dateLabel: await dateConvert(row.sale.date),
      amountLabel: await singlePrice(row.sale.payableAmount),
    })),
  );

  const total = await singlePrice(
    rows.reduce((sum, r) => sum + Number(r.sale.payableAmount), 0),
  );

  // An average alongside the total tells you whether a period's value came from
  // volume or from a few large sales, which the total alone hides.
  const averageLabel = await singlePrice(
    rows.length ? rows.reduce((sum, r) => sum + Number(r.sale.payableAmount), 0) / rows.length : 0,
  );
  const partyCount = new Set(rows.map((r) => r.customerName).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Sale History"
        breadcrumb={[{ label: 'Reports' }, { label: 'Sale History' }]}
        actions={
          <ReportFilter
            action={ROUTES['sale.history']}
            from={sp.from}
            to={sp.to}
            selects={[
              {
                name: 'customer_id',
                placeholder: 'All customers',
                value: sp.customer_id,
                options: customers.map((c) => ({ value: c.id, label: c.name })),
              },
              {
                name: 'house_id',
                placeholder: 'All branches and warehouses',
                value: sp.house_id,
                options: locations,
              },
            ]}
          />
        }
      />

      <ReportSummary
        figures={[
          { label: 'Value in range', value: total, detail: 'Total over the selected filters', icon: Wallet },
          { label: 'Sales', value: rows.length.toLocaleString('en-US'), detail: 'Matching the filters', icon: Receipt },
          { label: 'Average', value: averageLabel, detail: 'Per record in range', icon: Divide },
          { label: 'Customers', value: partyCount, detail: 'Distinct, in range', icon: Users },
        ]}
      />

      <Card title={`Sales (${rows.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Customer' },
            { label: 'Branch' },
            { label: 'Status' },
            { label: 'Amount' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No sales match this filter."
        >
          {decorated.map((row) => (
            <Tr key={row.sale.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                <Link
                  href={route('sale.show', { id: row.sale.id })}
                  className="text-primary hover:text-primary"
                >
                  {row.sale.invoiceNo ?? row.sale.id}
                </Link>
              </Td>
              <Td>{row.customerName ?? 'Walk-in'}</Td>
              <Td>{row.showroomName ?? '-'}</Td>
              <Td>
                <Badge color={row.sale.status === 1 ? 'success':'warning'} size="sm">
                  {row.sale.status === 1 ? 'Paid':'Unpaid'}
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
