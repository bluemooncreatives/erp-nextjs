import { LinkButton } from '@/components/common/link-button';
// Branch details - port of ShowRoomController@show (`inventory::showroom.show`):
// the branch profile, its sale and earnings summaries, the ledger of its own
// chart account, and the opening-balance form.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { authorize, can } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { payments, productItemDetails, sales, showRooms } from '@/lib/db/schema';
import { findContactAccount } from '@/lib/accounting/accounts';
import { accountStatement } from '@/lib/accounting/reports';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { Card, DetailList, PageHeader } from '@/components/erp/page';
import { DataTable, StatusBadge, Td, Tr } from '@/components/erp/table';
import { ShowroomOpeningBalanceForm } from './opening-balance-form';

export const metadata: Metadata = { title: 'Branch Details' };

export default async function ShowroomDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('showroom.show');
  const { id } = await params;

  const [showroom] = await db
    .select()
    .from(showRooms)
    .where(eq(showRooms.id, Number(id)))
    .limit(1);
  if (!showroom) notFound();

  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';
  const money = (value: number | string | null | undefined) =>
    `${symbol} ${numberFormat(value)}`;

  // `getAccountsAttribute()` - sales raised by this branch, what has been paid,
  // and what was returned.
  const [totals] = await db
    .select({
      payable: sql<number>`coalesce(sum(${sales.payableAmount}), 0)`,
      count: sql<number>`count(*)`,
      dueCount: sql<number>`coalesce(sum(case when ${sales.isApproved} = 0 then 1 else 0 end), 0)`,
    })
    .from(sales)
    .where(
      sql`${sales.saleableId} = ${showroom.id} and ${sales.saleableType} = ${MorphType.ShowRoom}`,
    );

  const [paidRow] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(
      sales,
      sql`${sales.id} = ${payments.payableId} and ${payments.payableType} = ${MorphType.Sale}`,
    )
    .where(
      sql`${sales.saleableId} = ${showroom.id} and ${sales.saleableType} = ${MorphType.ShowRoom}`,
    );

  const [returnRow] = await db
    .select({ returned: sql<number>`coalesce(sum(${productItemDetails.returnAmount}), 0)` })
    .from(productItemDetails)
    .innerJoin(
      sales,
      sql`${sales.id} = ${productItemDetails.itemableId} and ${productItemDetails.itemableType} = ${MorphType.Sale}`,
    )
    .where(
      sql`${sales.saleableId} = ${showroom.id} and ${sales.saleableType} = ${MorphType.ShowRoom}`,
    );

  const total = Number(totals?.payable ?? 0) - Number(returnRow?.returned ?? 0);
  const paid = Number(paidRow?.paid ?? 0);
  const due = total - paid;

  const account = await findContactAccount(showroom.id, MorphType.ShowRoom);
  const statement = account ? await accountStatement(account.id) : null;
  const canAddBalance = await can('showroom_openning_balance.store');

  const statementRows = statement
    ? await Promise.all(
        statement.rows.map(async (row) => ({
          id: row.id,
          dateLabel: await dateConvert(row.date),
          narration: row.narration,
          debit: row.type === 'Dr' ? money(row.amount) : '',
          credit: row.type === 'Cr' ? money(row.amount) : '',
          balance: money(row.balance),
        })),
      )
    : [];

  return (
    <>
      <PageHeader
        title={showroom.name}
        breadcrumb={[
          { label: 'Branch', href: ROUTES['showroom.index'] },
          { label: showroom.name },
        ]}
        actions={
          <LinkButton
            href={route('product_movement.index', {}, { showroom_id: showroom.id })}
            
          >
            Products
          </LinkButton>
        }
      />

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Branch Details" className="lg:col-span-2">
            <DetailList
              columns={2}
              items={[
                { label: 'Name', value: showroom.name },
                { label: 'Email', value: showroom.email ?? '-' },
                { label: 'Phone', value: showroom.phone ?? '-' },
                { label: 'Address', value: showroom.address ?? '-' },
                {
                  label: 'Registered Date',
                  value: showroom.createdAt ? await dateConvert(showroom.createdAt) : '-',
                },
                {
                  label: 'Active Status',
                  value: <StatusBadge status={showroom.status} />,
                },
              ]}
            />
          </Card>

          <div className="space-y-5">
            <Card title="Sale Information">
              <DetailList
                columns={1}
                items={[
                  { label: 'Total Invoice', value: Number(totals?.count ?? 0) },
                  { label: 'Due Invoice', value: Number(totals?.dueCount ?? 0) },
                ]}
              />
            </Card>

            <Card title="Earnings Information">
              <DetailList
                columns={1}
                items={[
                  { label: 'Total Balance', value: money(total) },
                  { label: 'Paid', value: money(paid) },
                  { label: 'Due Balance', value: money(due) },
                ]}
              />
            </Card>
          </div>
        </div>

        {canAddBalance && account ? (
          <ShowroomOpeningBalanceForm showroomId={showroom.id} />
        ) : null}

        <Card title="Transactions" bodyClassName="">
          <DataTable
            columns={[
              { label: 'Date' },
              { label: 'Description' },
              { label: 'Debit' },
              { label: 'Credit' },
              { label: 'Balance' },
            ]}
            isEmpty={statementRows.length === 0}
            empty={account ? 'No transactions.':'This branch has no ledger account.'}
          >
            {statementRows.map((row) => (
              <Tr key={row.id}>
                <Td>{row.dateLabel || '-'}</Td>
                <Td>{row.narration ?? '-'}</Td>
                <Td>{row.debit}</Td>
                <Td>{row.credit}</Td>
                <Td>{row.balance}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </>
  );
}
