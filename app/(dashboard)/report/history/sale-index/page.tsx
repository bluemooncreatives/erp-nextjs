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
import { DataTable, Td, Tr } from '@/components/erp/table';
import Badge from '@/components/ui/badge/Badge';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Sale History' };

export default async function SaleHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customer_id?: string }>;
}) {
  const user = await authorize('sale.history');
  const sp = await searchParams;
  const session = await getSession();

  const [rows, customers, locations] = await Promise.all([
    saleHistory({
      from: sp.from,
      to: sp.to,
      customerId: sp.customer_id ? Number(sp.customer_id) : undefined,
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
            ]}
          />
        }
      />

      <Card title={`Sales (${rows.length}) - ${total}`} bodyClassName="">
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
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                <Link
                  href={route('sale.show', { id: row.sale.id })}
                  className="text-brand-500 hover:text-brand-600"
                >
                  {row.sale.invoiceNo ?? row.sale.id}
                </Link>
              </Td>
              <Td>{row.customerName ?? 'Walk-in'}</Td>
              <Td>{row.showroomName ?? '-'}</Td>
              <Td>
                <Badge color={row.sale.status === 1 ? 'success' : 'warning'} size="sm">
                  {row.sale.status === 1 ? 'Paid' : 'Unpaid'}
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
