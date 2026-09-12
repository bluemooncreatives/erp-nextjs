// Sale return list - port of SaleController@returnList
// (`sale::sale.make_return_list` / `return_item_list`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listSales, SaleReturnStatus } from '@/lib/sale/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import { approveSaleReturnAction } from '../actions';

export const metadata: Metadata = { title: 'Sale Return' };

export default async function SaleReturnListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('sale.return.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listSales({
    search: sp.search,
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
    returnsOnly: true,
  });

  const canApprove = await can('return.sale.approve');

  const returnRows = await Promise.all(
    rows.map(async (sale) => ({ ...sale, dateLabel: await dateConvert(sale.date) })),
  );

  return (
    <>
      <PageHeader
        title="Sale Return"
        breadcrumb={[{ label: 'Sale' }, { label: 'Sale Return' }]}
      />

      <Card
        title={`Returns (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['sale.return.index']}
            defaultValue={sp.search}
            placeholder="Search invoice..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Customer' },
            { label: 'Total' },
            { label: 'Return Status' },
            { label: 'Action' },
          ]}
          isEmpty={returnRows.length === 0}
          empty="No returns found."
        >
          {returnRows.map((sale) => (
            <Tr key={sale.id}>
              <Td>
                <Link
                  href={route('sale.show', { id: sale.id })}
                  className="font-medium text-brand-500 hover:text-brand-600"
                >
                  {sale.invoiceNo ?? sale.id}
                </Link>
              </Td>
              <Td>{sale.dateLabel}</Td>
              <Td>{sale.customerName ?? sale.agentName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(sale.payableAmount)}`}</Td>
              <Td>
                <Badge
                  size="sm"
                  color={
                    sale.returnStatus === SaleReturnStatus.Accepted ? 'success' : 'warning'
                  }
                >
                  {sale.returnStatus === SaleReturnStatus.Accepted
                    ? 'Accepted'
                    : 'Pending'}
                </Badge>
              </Td>
              <Td>
                {sale.returnStatus === SaleReturnStatus.Pending && canApprove ? (
                  <form action={approveSaleReturnAction}>
                    <input type="hidden" name="id" value={sale.id} />
                    <ActionButton
                      variant="primary"
                      confirm="Accept this return? Stock goes back and the ledger is posted."
                    >
                      Approve Return
                    </ActionButton>
                  </form>
                ) : (
                  '-'
                )}
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['sale.return.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
