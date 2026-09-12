// `sale.due.list` - SaleController@dueList, `sale::sale.due_list`.
//
// `dueList('all')` is `is_approved = 1 and status != 1` over the session's
// branch, which is exactly `listSales({ isApproved: 1, dueOnly: true })`. The
// Blade showed every row at once; this pages and searches like the sale list,
// because the query is the same one.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listSales } from '@/lib/sale/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ListSummary } from '@/components/common/list-summary';

export const metadata: Metadata = { title: 'Payment Due List' };

export default async function SaleDueListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('sale.due.list');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listSales({
    search: sp.search,
    page: Number(sp.page ?? 1),
    isApproved: 1,
    dueOnly: true,
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const canShow = await can('sale.show');

  const dueRows = await Promise.all(
    rows.map(async (sale) => ({
      ...sale,
      dateLabel: await dateConvert(sale.date),
      dueAmount: Number(sale.payableAmount) - sale.paidAmount,
    })),
  );

  const outstanding = dueRows.reduce((sum, row) => sum + row.dueAmount, 0);

  return (
    <>
      <PageHeader
        title="Payment Due List"
        breadcrumb={[{ label: 'Sale' }, { label: 'Payment Due List' }]}
      />

      <ListSummary
        total={total}
        visible={dueRows.length}
        amount={`${symbol} ${numberFormat(outstanding)}`}
        amountLabel="Outstanding on this page"
      />

      <Card
        title={`Unpaid invoices (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['sale.due.list']}
            defaultValue={sp.search}
            placeholder="Search invoice or customer..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Invoice No' },
            { label: 'Date' },
            { label: 'Branch' },
            { label: 'Payable Amount' },
            { label: 'Customer' },
            { label: 'Paid Amount' },
            { label: 'Due' },
          ]}
          isEmpty={dueRows.length === 0}
          empty="No payments are due."
        >
          {dueRows.map((sale) => (
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
              <Td>{sale.customerName ?? sale.agentName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(sale.paidAmount)}`}</Td>
              <Td>{`${symbol} ${numberFormat(sale.dueAmount)}`}</Td>
            </Tr>
          ))}
        </DataTable>
        <Pagination
          total={total}
          page={page}
          perPage={perPage}
          baseUrl={ROUTES['sale.due.list']}
          params={sp}
        />
      </Card>
    </>
  );
}
