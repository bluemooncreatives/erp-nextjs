import { LinkButton } from '@/components/common/link-button';
// Stock transfer list - port of StockTransferController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listStockTransfers } from '@/lib/inventory/transfers';
import { dateConvert } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Hourglass, Send, Truck, ArrowLeftRight } from 'lucide-react';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import {
  deleteTransferAction,
  receiveTransferAction,
  sendTransferAction,
  changeTransferStatusAction,
} from '../actions';
import { Phrase } from '@/context/TranslationContext';

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

  // A transfer moves through approve -> dispatch -> receive, so each counter is
  // one of those queues rather than a single undifferentiated total.
  const pendingApproval = transferRows.filter((t) => t.status !== 1).length;
  const awaitingDispatch = transferRows.filter((t) => t.status === 1 && !t.sentAt).length;
  const inTransit = transferRows.filter((t) => t.sentAt && !t.receivedAt).length;

  return (
    <>
      <PageHeader
        title="Stock Transfer"
        breadcrumb={[{ label: 'Inventory'}, { label:'Stock Transfer' }]}
        actions={
          canCreate ? (
            <LinkButton
              href={ROUTES['stock-transfer.create']}
              
            >
              Add Transfer
            </LinkButton>
          ) : null
        }
      />

      <ReportSummary
        figures={[
          { label: 'Pending approval', value: pendingApproval, detail: 'On this page', icon: Hourglass },
          { label: 'Awaiting dispatch', value: awaitingDispatch, detail: 'Approved, not yet sent', icon: Send },
          { label: 'In transit', value: inTransit, detail: 'Sent, not yet received', icon: Truck },
          { label: 'Transfers', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: ArrowLeftRight },
        ]}
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
                  {canEdit && transfer.status === 0 && !transfer.receivedAt && <Link className="text-primary hover:underline" href={`/inventory/stock-transfer/${transfer.id}/edit`}><Phrase>Edit</Phrase></Link>}
                  {canApprove && transfer.status === 0 && <form action={changeTransferStatusAction}><input type="hidden" name="id" value={transfer.id} /><ActionButton variant="primary"><Phrase>Approve</Phrase></ActionButton></form>}
                  {canShow && <Link className="text-primary hover:underline" href={`/inventory/stock-transfer/${transfer.id}`}><Phrase>Details</Phrase></Link>}
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
                        <Phrase>Receive</Phrase>
                      </ActionButton>
                    </form>
                  ) : null}
                  {canDelete && !transfer.receivedAt ? (
                    <form action={deleteTransferAction}>
                      <input type="hidden" name="id" value={transfer.id} />
                      <ActionButton confirm="Delete this transfer?"><Phrase>Delete</Phrase></ActionButton>
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
