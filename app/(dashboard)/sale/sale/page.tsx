import { LinkButton } from '@/components/common/link-button';
// Sale list - port of SaleController@index (`sale::sale.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listSales, SaleStatus } from '@/lib/sale/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { approveSaleAction, deleteSaleAction } from '../actions';

export const metadata: Metadata = { title: 'Sale' };

export default async function SaleListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('sale.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listSales({
    search: sp.search,
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const [canCreate, canEdit, canDelete, canApprove, canShow] = await Promise.all([
    can('sale.store'),
    can('sale.edit'),
    can('sale.delete'),
    can('conditional.sale.approve'),
    can('sale.show'),
  ]);

  // Dates go through the configured format; resolve them before rendering.
  const saleRows = await Promise.all(
    rows.map(async (sale) => ({
      ...sale,
      dateLabel: await dateConvert(sale.date),
      dueAmount: Number(sale.payableAmount) - sale.paidAmount,
    })),
  );

  return (
    <>
      <PageHeader
        title="Sale"
        breadcrumb={[{ label: 'Sale' }]}
        actions={
          canCreate ? (
            <LinkButton
              href={ROUTES['sale.create']}
              
            >
              Add Sale
            </LinkButton>
          ) : null
        }
      />

      <Card
        title={`Sales (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['sale.index']}
            defaultValue={sp.search}
            placeholder="Search invoice or customer..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Customer' },
            { label: 'Branch' },
            { label: 'Total' },
            { label: 'Paid' },
            { label: 'Due' },
            { label: 'Status' },
            { label: 'Approval' },
            { label: 'Action' },
          ]}
          isEmpty={saleRows.length === 0}
          empty="No sales found."
        >
          {saleRows.map((sale) => (
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
              <Td>{sale.customerName ?? sale.agentName ?? '-'}</Td>
              <Td>{sale.locationName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(sale.payableAmount)}`}</Td>
              <Td>{`${symbol} ${numberFormat(sale.paidAmount)}`}</Td>
              <Td>{`${symbol} ${numberFormat(sale.dueAmount)}`}</Td>
              <Td>
                <Badge
                  size="sm"
                  color={
                    sale.status === SaleStatus.Paid
                      ? 'success'
                      : sale.status === SaleStatus.Partial
                        ? 'warning'
                        : 'error'
                  }
                >
                  {sale.status === SaleStatus.Paid
                    ? 'Paid'
                    : sale.status === SaleStatus.Partial
                      ? 'Partial'
                      : 'Unpaid'}
                </Badge>
              </Td>
              <Td>
                {sale.isApproved === 1 ? (
                  <Badge size="sm" color="success">
                    Approved
                  </Badge>
                ) : canApprove ? (
                  <form action={approveSaleAction}>
                    <input type="hidden" name="id" value={sale.id} />
                    <ActionButton
                      variant="primary"
                      confirm={`Approve invoice ${sale.invoiceNo ?? sale.id}? This posts the ledger entries and deducts stock.`}
                    >
                      Approve
                    </ActionButton>
                  </form>
                ) : (
                  <Badge size="sm" color="warning">
                    Pending
                  </Badge>
                )}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canEdit && sale.isApproved !== 1 ? (
                    <LinkButton
                      href={route('sale.edit', { id: sale.id })}
                      
                    >
                      Edit
                    </LinkButton>
                  ) : null}
                  {canDelete ? (
                    <form action={deleteSaleAction}>
                      <input type="hidden" name="id" value={sale.id} />
                      <ActionButton
                        confirm={`Delete invoice ${sale.invoiceNo ?? sale.id}? Stock will be returned.`}
                      >
                        Delete
                      </ActionButton>
                    </form>
                  ) : null}
                </div>
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['sale.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
