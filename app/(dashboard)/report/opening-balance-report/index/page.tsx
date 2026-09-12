// Opening balance report - port of ReportController@index
// (`report::opening_balance_report.index`), listing `type_opening_balances`.

import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { chartAccounts, typeOpeningBalances } from '@/lib/db/schema';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportFilter } from '../../report-filter';

export const metadata: Metadata = { title: 'Opening Balance Report' };

export default async function OpeningBalanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await authorize('opening_balance_report.index');
  const sp = await searchParams;

  const query = db
    .select({
      row: typeOpeningBalances,
      accountName: chartAccounts.name,
      accountCode: chartAccounts.code,
    })
    .from(typeOpeningBalances)
    .leftJoin(chartAccounts, eq(chartAccounts.id, typeOpeningBalances.accountId));

  const rows = sp.type
    ? await query.where(eq(typeOpeningBalances.type, sp.type))
    : await query;

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      amountLabel: await singlePrice(row.row.amount),
      dateLabel: await dateConvert(row.row.createdAt),
    })),
  );

  const total = await singlePrice(rows.reduce((sum, r) => sum + Number(r.row.amount), 0));

  return (
    <>
      <PageHeader
        title="Opening Balance Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Opening Balance' }]}
        actions={
          <ReportFilter
            action={ROUTES['opening_balance_report.index']}
            selects={[
              {
                name: 'type',
                placeholder: 'All types',
                value: sp.type,
                options: [
                  { value: 'customer', label: 'Customer' },
                  { value: 'supplier', label: 'Supplier' },
                  { value: 'showroom', label: 'Showroom' },
                  { value: 'staff', label: 'Staff' },
                ],
              },
            ]}
          />
        }
      />

      <Card title={`Opening balances (${rows.length}) - ${total}`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Account' },
            { label: 'Type' },
            { label: 'Amount' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No opening balances recorded."
        >
          {decorated.map((row) => (
            <Tr key={row.row.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-foreground">
                {`${row.accountName ?? '-'}${row.accountCode ? ` (${row.accountCode})` : ''}`}
              </Td>
              <Td className="capitalize">{row.row.type ?? '-'}</Td>
              <Td>{row.amountLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
