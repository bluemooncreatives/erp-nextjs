// Stock adjustment list - port of StockAdjustmentController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listStockAdjustments } from '@/lib/inventory/transfers';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import { approveAdjustmentAction, deleteAdjustmentAction } from '../../actions';

export const metadata: Metadata = { title: 'Stock Adjustment' };

export default async function StockAdjustmentListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await authorize('stock_adjustment.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listStockAdjustments({
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const [canCreate, canApprove, canDelete, canShow, canEdit] = await Promise.all([
    can('stock_adjustment.store'),
    can('stock_adjustment.approve'),
    can('stock_adjustment.destroy'),
    can('stock_adjustment.show'),
    can('stock_adjustment.edit'),
  ]);

  const adjustmentRows = await Promise.all(
    rows.map(async (a) => ({ ...a, dateLabel: await dateConvert(a.date) })),
  );

  return (
    <>
      <PageHeader
        title="Stock Adjustment"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Stock Adjustment' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['stock_adjustment.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Adjustment
            </Link>
          ) : null
        }
      />

      <Card title={`Adjustments (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Reference' },
            { label: 'Date' },
            { label: 'Location' },
            { label: 'Recovery amount' },
            { label: 'Reason' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={adjustmentRows.length === 0}
          empty="No stock adjustments found."
        >
          {adjustmentRows.map((adjustment) => (
            <Tr key={adjustment.id}>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {adjustment.refNo ?? adjustment.id}
              </Td>
              <Td>{adjustment.dateLabel}</Td>
              <Td>{adjustment.locationName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(adjustment.recoveryAmount)}`}</Td>
              <Td className="max-w-xs truncate">{adjustment.reason ?? '-'}</Td>
              <Td>
                <Badge size="sm" color={adjustment.status === 1 ? 'success' : 'warning'}>
                  {adjustment.status === 1 ? 'Applied' : 'Pending'}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canEdit && adjustment.status !== 1 && <Link className="text-brand-500 hover:underline" href={`/inventory/stock-adjustment/edit/${adjustment.id}`}>Edit</Link>}
                  {canShow && <Link className="text-brand-500 hover:underline" href={`/inventory/stock-adjustment/show/${adjustment.id}`}>Details</Link>}
                  {adjustment.status !== 1 && canApprove ? (
                    <form action={approveAdjustmentAction}>
                      <input type="hidden" name="id" value={adjustment.id} />
                      <ActionButton
                        variant="primary"
                        confirm="Apply this adjustment? The stock will be written off."
                      >
                        Approve
                      </ActionButton>
                    </form>
                  ) : null}
                  {canDelete && adjustment.status !== 1 ? (
                    <form action={deleteAdjustmentAction}>
                      <input type="hidden" name="id" value={adjustment.id} />
                      <ActionButton confirm="Delete this adjustment?">Delete</ActionButton>
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
          baseUrl={ROUTES['stock_adjustment.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
