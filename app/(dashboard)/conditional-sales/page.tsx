import { LinkButton } from '@/components/common/link-button';
// Sale on Condition - port of SaleController@conditionalSale
// (`sale::conditional_sale.index`): the sales whose `type` is 0, with the
// approval action and the delivery receipt the Blade's modal recorded.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import {
  SaleKind,
  latestShippingBySale,
  listSales,
} from '@/lib/sale/queries';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Hourglass, CircleCheck, Truck, Wallet } from 'lucide-react';
import { DataTable, Pagination, SearchBar, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { approveSaleAction } from '../sale/actions';
import { ReceiveOrderForm } from './receive-form';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Sale on Condition' };

export default async function ConditionalSalePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await authorize('conditional.sale.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listSales({
    search: sp.search,
    page: Number(sp.page ?? 1),
    type: SaleKind.Conditional,
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const [canApprove, canShow, canEdit] = await Promise.all([
    can('conditional.sale.approve'),
    can('sale.show'),
    can('sale.edit'),
  ]);

  const shipping = await latestShippingBySale(rows.map((r) => r.id));

  const saleRows = await Promise.all(
    rows.map(async (sale) => ({
      ...sale,
      dateLabel: await dateConvert(sale.date),
      receivedBy: shipping.get(sale.id)?.receivedBy ?? null,
      receivedDateLabel: await dateConvert(shipping.get(sale.id)?.receivedDate),
      hasShipping: shipping.has(sale.id),
    })),
  );

  // A conditional sale is only closed once it is approved *and* the goods are
  // acknowledged as received, so both queues get a counter.
  const approvedCount = saleRows.filter((s) => s.isApproved === 1).length;
  const pendingCount = saleRows.length - approvedCount;
  const awaitingReceipt = saleRows.filter((s) => s.hasShipping && !s.receivedBy).length;
  const pageValue = saleRows.reduce((sum, s) => sum + Number(s.payableAmount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Sale on Condition"
        breadcrumb={[{ label: 'Sale' }, { label: 'Sale on Condition' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Pending approval', value: pendingCount, detail: 'On this page', icon: Hourglass },
          { label: 'Approved', value: approvedCount, detail: 'On this page', icon: CircleCheck },
          { label: 'Awaiting receipt', value: awaitingReceipt, detail: 'Shipped, not acknowledged', icon: Truck },
          { label: 'Value on this page', value: `${symbol} ${numberFormat(pageValue)}`, detail: `${saleRows.length} of ${total} sales`, icon: Wallet },
        ]}
      />

      <Card
        title={`Conditional Sales (${total})`}
        bodyClassName=""
        actions={
          <SearchBar
            action={ROUTES['conditional.sale.index']}
            defaultValue={sp.search}
            placeholder="Search invoice or customer..."
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Invoice' },
            { label: 'Customer' },
            { label: 'Total' },
            { label: 'Approval' },
            { label: 'Received By' },
            { label: 'Action' },
          ]}
          isEmpty={saleRows.length === 0}
          empty="No conditional sales found."
        >
          {saleRows.map((sale) => (
            <Tr key={sale.id}>
              <Td>{sale.dateLabel || '-'}</Td>
              <Td className="font-medium text-foreground">
                {sale.invoiceNo ?? sale.id}
              </Td>
              <Td>{sale.customerName ?? sale.agentName ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(sale.payableAmount)}`}</Td>
              <Td>
                <Badge color={sale.isApproved === 1 ? 'success' : 'warning'} size="sm">
                  {sale.isApproved === 1 ? 'Approved':'Pending'}
                </Badge>
              </Td>
              <Td>
                {sale.receivedBy
                  ? `${sale.receivedBy}${sale.receivedDateLabel ? ` (${sale.receivedDateLabel})` : ''}`
                  : '-'}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {canShow ? (
                    <Link
                      href={route('sale.show', { id: sale.id })}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      <Phrase>Order Details</Phrase>
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <LinkButton
                      href={route('sale.edit', { id: sale.id })}
                      
                    >
                      <Phrase>Edit</Phrase>
                    </LinkButton>
                  ) : null}
                  {canApprove && sale.isApproved !== 1 ? (
                    <form action={approveSaleAction}>
                      <input type="hidden" name="id" value={sale.id} />
                      <ActionButton
                        variant="primary"
                        confirm="Approve this sale? Stock will be deducted and the ledger posted."
                      >
                        <Phrase>Approve</Phrase>
                      </ActionButton>
                    </form>
                  ) : null}
                  {sale.hasShipping && !sale.receivedBy ? (
                    <ReceiveOrderForm saleId={sale.id} />
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
          baseUrl={ROUTES['conditional.sale.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
