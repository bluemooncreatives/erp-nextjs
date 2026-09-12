// Account statement - port of GeneralLedgerController@statement.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { accountStatement, postableAccounts } from '@/lib/accounting/reports';
import { accountTypeName } from '@/lib/accounting/accounts';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, DetailList, EmptyState } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { DateRangeFilter } from '../date-range-filter';

export const metadata: Metadata = { title: 'Statement' };

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; from?: string; to?: string }>;
}) {
  await authorize('statement.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const accounts = await postableAccounts();
  const accountId = sp.account_id ? Number(sp.account_id) : null;

  const statement = accountId
    ? await accountStatement(accountId, { from: sp.from, to: sp.to })
    : null;

  const rows = statement
    ? await Promise.all(
        statement.rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.date) })),
      )
    : [];

  return (
    <>
      <PageHeader
        title="Statement"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Statement' }]}
      />

      <Card
        title={statement?.account ? statement.account.name : 'Select an account'}
        bodyClassName=""
        actions={
          <DateRangeFilter
            action={ROUTES['statement.index']}
            from={sp.from}
            to={sp.to}
            accountId={sp.account_id}
            accounts={accounts.map((a) => ({
              value: a.id,
              label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
            }))}
          />
        }
      >
        {!statement?.account ? (
          <EmptyState message="Choose an account to see its ledger." />
        ) : (
          <>
            <div className="p-4 sm:p-6">
              <DetailList
                columns={3}
                items={[
                  { label: 'Account', value: statement.account.name },
                  { label: 'Code', value: statement.account.code ?? '-' },
                  { label: 'Type', value: accountTypeName(statement.account.type) },
                  {
                    label: 'Closing balance',
                    value: `${symbol} ${numberFormat(statement.closingBalance)}`,
                  },
                ]}
              />
            </div>

            <DataTable
              columns={[
                { label: 'Date' },
                { label: 'Voucher' },
                { label: 'Narration' },
                { label: 'Debit' },
                { label: 'Credit' },
                { label: 'Balance' },
              ]}
              isEmpty={rows.length === 0}
              empty="No postings in this period."
            >
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>{row.dateLabel}</Td>
                  <Td>{row.txId ?? '-'}</Td>
                  <Td className="max-w-xs truncate">{row.narration ?? '-'}</Td>
                  <Td>
                    {row.type === 'Dr' ? `${symbol} ${numberFormat(row.amount)}` : '-'}
                  </Td>
                  <Td>
                    {row.type === 'Cr' ? `${symbol} ${numberFormat(row.amount)}` : '-'}
                  </Td>
                  <Td className="font-medium">{`${symbol} ${numberFormat(row.balance)}`}</Td>
                </Tr>
              ))}
            </DataTable>
          </>
        )}
      </Card>
    </>
  );
}
