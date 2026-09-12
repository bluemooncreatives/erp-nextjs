// Purchase return list - port of PurchaseOrderController@returnList.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { PurchaseReturnStatus, listPurchaseOrders } from '@/lib/purchase/repository';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Hourglass, CircleCheck, Wallet, Undo2 } from 'lucide-react';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { approvePurchaseReturnAction } from '../actions';

export const metadata: Metadata = { title: 'Purchase Return' };

export default async function PurchaseReturnListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('purchase.return.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listPurchaseOrders({
    search: sp.search,
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
    returnsOnly: true,
  });

  const canApprove = await can('return.purchase.approve');

  const returnRows = await Promise.all(
    rows.map(async (order) => ({
      ...order,
      dateLabel: await dateConvert(order.date),
    })),
  );

  const approvedCount = returnRows.filter((o) => o.returnStatus === PurchaseReturnStatus.Approved).length;
  const pendingCount = returnRows.length - approvedCount;
  const pageValue = returnRows.reduce((sum, o) => sum + Number(o.payableAmount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Purchase Return"
        breadcrumb={[{ label: 'Purchase' }, { label: 'Purchase Return' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Pending approval', value: pendingCount, detail: 'On this page', icon: Hourglass },
          { label: 'Approved', value: approvedCount, detail: 'On this page', icon: CircleCheck },
          { label: 'Value on this page', value: `${symbol} ${numberFormat(pageValue)}`, detail: `${returnRows.length} of ${total} returns`, icon: Wallet },
          { label: 'Purchase returns', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Undo2 },
        ]}
      />

      <Card
        title={`Returns (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['purchase.return.index']}
            defaultValue={sp.search}
            placeholder="Search invoice..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Invoice' },
            { label: 'Date' },
            { label: 'Supplier' },
            { label: 'Total' },
            { label: 'Return Status' },
            { label: 'Action' },
          ]}
          isEmpty={returnRows.length === 0}
          empty="No purchase returns found."
        >
          {returnRows.map((order) => (
            <Tr key={order.id}>
              <Td>
                <Link
                  href={route('purchase_order.show', { id: order.id })}
                  className="font-medium text-primary hover:text-primary"
                >
                  {order.invoiceNo || order.id}
                </Link>
              </Td>
              <Td>{order.dateLabel}</Td>
              <Td>{order.supplierName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(order.payableAmount)}`}</Td>
              <Td>
                <Badge
                  size="sm"
                  color={
                    order.returnStatus === PurchaseReturnStatus.Approved
                      ? 'success'
                      : 'warning'
                  }
                >
                  {order.returnStatus === PurchaseReturnStatus.Approved
                    ? 'Approved'
                    : 'Pending'}
                </Badge>
              </Td>
              <Td>
                {order.returnStatus === PurchaseReturnStatus.Pending && canApprove ? (
                  <form action={approvePurchaseReturnAction}>
                    <input type="hidden" name="id" value={order.id} />
                    <ActionButton
                      variant="primary"
                      confirm="Approve this return? Stock leaves the branch and the ledger is posted."
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
          baseUrl={ROUTES['purchase.return.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
