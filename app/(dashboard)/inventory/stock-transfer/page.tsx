// Stock transfer list - port of StockTransferController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listStockTransfers } from '@/lib/inventory/transfers';
import { dateConvert } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import {
  deleteTransferAction,
  receiveTransferAction,
  sendTransferAction,
  changeTransferStatusAction,
} from '../actions';

export const metadata: Metadata = { title: 'Stock Transfer' };

export default async function StockTransferListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await authorize('stock-transfer.index');
  const sp = await searchParams;
  const session = await getSession();

  const { rows, total, page, perPage } = await listStockTransfers({
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const [canCreate, canSend, canReceive, canDelete, canShow, canEdit, canApprove] = await Promise.all([
    can('stock-transfer.store'),
    can('stock-transfer.sent'),
    can('stock-transfer.receive'),
    can('stock-transfer.delete'),
    can('stock-transfer.show'),
    can('stock-transfer.edit'),
    can('stock-transfer.status'),
  ]);

  const transferRows = await Promise.all(
    rows.map(async (t) => ({
      ...t,
      dateLabel: await dateConvert(t.date),
      sentLabel: t.sentAt ? await dateConvert(t.sentAt) : null,
      receivedLabel: t.receivedAt ? await dateConvert(t.receivedAt) : null,
    })),
  );

  return (
    <>
      <PageHeader
        title="Stock Transfer"
        breadcrumb={[{ label: 'Inventory' }, { label: 'Stock Transfer' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['stock-transfer.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Transfer
            </Link>
          ) : null
        }
      />

      <Card title={`Transfers (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'From' },
            { label: 'To' },
            { label: 'Sent' },
            { label: 'Received' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={transferRows.length === 0}
          empty="No stock transfers found."
        >
          {transferRows.map((transfer) => (
            <Tr key={transfer.id}>
              <Td>{transfer.dateLabel}</Td>
              <Td>{transfer.fromName ?? '-'}</Td>
              <Td>{transfer.toName ?? '-'}</Td>
              <Td>{transfer.sentLabel ?? '-'}</Td>
              <Td>{transfer.receivedLabel ?? '-'}</Td>
              <Td>
                <Badge size="sm" color={transfer.status === 1 ? 'success' : 'warning'}>
                  {transfer.status === 1 ? 'Approved' : 'Pending'}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canEdit && transfer.status === 0 && !transfer.receivedAt && <Link className="text-brand-500 hover:underline" href={`/inventory/stock-transfer/${transfer.id}/edit`}>Edit</Link>}
                  {canApprove && transfer.status === 0 && <form action={changeTransferStatusAction}><input type="hidden" name="id" value={transfer.id} /><ActionButton variant="primary">Approve</ActionButton></form>}
                  {canShow && <Link className="text-brand-500 hover:underline" href={`/inventory/stock-transfer/${transfer.id}`}>Details</Link>}
                  {!transfer.sentAt && canSend ? (
                    <form action={sendTransferAction}>
                      <input type="hidden" name="id" value={transfer.id} />
                      <ActionButton variant="primary">Dispatch</ActionButton>
                    </form>
                  ) : null}
                  {transfer.status === 1 && !transfer.receivedAt && canReceive ? (
                    <form action={receiveTransferAction}>
                      <input type="hidden" name="id" value={transfer.id} />
                      <ActionButton
                        variant="primary"
                        confirm="Receive this transfer? Stock moves between the locations."
                      >
                        Receive
                      </ActionButton>
                    </form>
                  ) : null}
                  {canDelete && !transfer.receivedAt ? (
                    <form action={deleteTransferAction}>
                      <input type="hidden" name="id" value={transfer.id} />
                      <ActionButton confirm="Delete this transfer?">Delete</ActionButton>
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
          baseUrl={ROUTES['stock-transfer.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
