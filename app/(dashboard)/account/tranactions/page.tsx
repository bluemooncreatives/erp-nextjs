// Transactions - port of TransactionController@index.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { listTransactions } from '@/lib/accounting/reports';
import { postableAccounts } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { morphName } from '@/lib/db/morph';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { DateRangeFilter } from '../date-range-filter';

export const metadata: Metadata = { title: 'Transactions' };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    account_id?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await authorize('transaction.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [{ rows, total, page, perPage }, accounts] = await Promise.all([
    listTransactions({
      accountId: sp.account_id ? Number(sp.account_id) : undefined,
      range: { from: sp.from, to: sp.to },
      page: Number(sp.page ?? 1),
    }),
    postableAccounts(),
  ]);

  const txRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.date) })),
  );

  const debitTotal = rows
    .filter((r) => r.type === 'Dr')
    .reduce((sum, r) => sum + r.amount, 0);
  const creditTotal = rows
    .filter((r) => r.type === 'Cr')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      <PageHeader
        title="Transactions"
        breadcrumb={[{ label: 'Accounts'}, { label:'Transactions' }]}
      />

      <Card
        title={`Postings (${total}) - Dr ${symbol} ${numberFormat(debitTotal)} / Cr ${symbol} ${numberFormat(creditTotal)}`}
        bodyClassName=""
        actions={
          <DateRangeFilter
            action={ROUTES['transaction.index']}
            from={sp.from}
            to={sp.to}
            accounts={accounts.map((a) => ({
              value: a.id,
              label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
            }))}
            accountId={sp.account_id}
          />
        }
      >
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Voucher' },
            { label: 'Account' },
            { label: 'Narration' },
            { label: 'Debit' },
            { label: 'Credit' },
            { label: 'Source' },
          ]}
          isEmpty={txRows.length === 0}
          empty="No transactions found."
        >
          {txRows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td>
                <span className="font-medium text-foreground">
                  {row.txId ?? '-'}
                </span>
                {row.isApprove !== 1 ? (
                  <Badge size="sm" color="warning">
                    Pending
                  </Badge>
                ) : null}
              </Td>
              <Td>
                {row.accountName}
                {row.accountCode ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({row.accountCode})
                  </span>
                ) : null}
              </Td>
              <Td className="max-w-xs truncate">{row.narration ?? '-'}</Td>
              <Td>{row.type === 'Dr' ? `${symbol} ${numberFormat(row.amount)}` : '-'}</Td>
              <Td>{row.type === 'Cr' ? `${symbol} ${numberFormat(row.amount)}` : '-'}</Td>
              <Td>
                {row.referableType
                  ? `${morphName(row.referableType) ?? ''} #${row.referableId}`
                  : '-'}
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['transaction.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
