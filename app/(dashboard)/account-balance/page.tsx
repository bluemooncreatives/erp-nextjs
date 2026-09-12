// Account balance (trial balance) - port of AccountBalanceController@index.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { accountBalances } from '@/lib/accounting/reports';
import { accountTypeName } from '@/lib/accounting/accounts';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { DateRangeFilter } from '../account/date-range-filter';

export const metadata: Metadata = { title: 'Account Balance' };

export default async function AccountBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await authorize('account.balance.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const rows = (await accountBalances({ from: sp.from, to: sp.to })).filter(
    (r) => r.debit !== 0 || r.credit !== 0,
  );

  const debitTotal = rows.reduce((sum, r) => sum + r.debit, 0);
  const creditTotal = rows.reduce((sum, r) => sum + r.credit, 0);

  return (
    <>
      <PageHeader
        title="Account Balance"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Account Balance' }]}
        actions={
          <DateRangeFilter
            action={ROUTES['account.balance.index']}
            from={sp.from}
            to={sp.to}
          />
        }
      />

      <Card
        title={`Balances (${rows.length}) - Dr ${symbol} ${numberFormat(debitTotal)} / Cr ${symbol} ${numberFormat(creditTotal)}`}
        desc={
          Math.abs(debitTotal - creditTotal) < 0.01
            ? 'The ledger balances.'
            : `Out of balance by ${symbol} ${numberFormat(Math.abs(debitTotal - creditTotal))}.`
        }
        bodyClassName=""
      >
        <DataTable
          columns={[
            { label: 'Code' },
            { label: 'Account' },
            { label: 'Type' },
            { label: 'Debit' },
            { label: 'Credit' },
            { label: 'Balance' },
          ]}
          isEmpty={rows.length === 0}
          empty="No balances to show."
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.code ?? '-'}</Td>
              <Td className="font-medium text-gray-700 dark:text-gray-300">{row.name}</Td>
              <Td>{accountTypeName(row.type)}</Td>
              <Td>{`${symbol} ${numberFormat(row.debit)}`}</Td>
              <Td>{`${symbol} ${numberFormat(row.credit)}`}</Td>
              <Td className="font-medium">{`${symbol} ${numberFormat(row.balance)}`}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
