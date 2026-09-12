// Ledger report - port of LedgerReportController@index
// (`report::leadger_report.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import {
  ledgerAccounts,
  ledgerOpeningBalance,
  ledgerRows,
} from '@/lib/reports/statements';
import { findAccount } from '@/lib/accounting/accounts';
import { dateConvert, singlePrice } from '@/lib/settings';
import { toDateString } from '@/lib/php-date';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { FormAlert } from '@/components/erp/fields';

export const metadata: Metadata = { title: 'Ledger Report' };

export default async function LedgerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; dateFrom?: string; dateTo?: string }>;
}) {
  await authorize('leadger_report.index');
  const sp = await searchParams;

  const accounts = await ledgerAccounts();
  const accountId = Number(sp.account_id) || null;
  const from = toDateString(sp.dateFrom);
  const to = toDateString(sp.dateTo);

  // The controller's three guard messages.
  const warning =
    from && to && !accountId
      ? 'Select Account First'
      : to && !from
        ? 'You need to set date-from when you select date-to.'
        : from && !to
          ? 'You need to set date-to when you select date-from.'
          : null;

  const account = accountId ? await findAccount(accountId) : null;

  const opening =
    account && from
      ? await ledgerOpeningBalance(account.id, Number(account.type), from)
      : 0;

  const rows = account && !warning ? await ledgerRows(account.id, from, to) : [];

  const debitPositive = account
    ? Number(account.type) === 1 || Number(account.type) === 4
    : true;

  // Running balance per row, worked out before the labels are formatted: the
  // awaits below resume out of order, so the balance cannot be accumulated
  // inside the formatting pass.
  const withBalances = rows.reduce<Array<{ row: (typeof rows)[number]; amount: number; balance: number }>>(
    (acc, row) => {
      const amount = Number(row.amount);
      const signed =
        row.type === 'Dr' ? (debitPositive ? amount : -amount) : debitPositive ? -amount : amount;
      const balance = (acc.length ? acc[acc.length - 1].balance : opening) + signed;
      acc.push({ row, amount, balance });
      return acc;
    },
    [],
  );

  const decorated = await Promise.all(
    withBalances.map(async ({ row, amount, balance }) => ({
      ...row,
      amount,
      balance,
      dateLabel: await dateConvert(row.date ?? row.createdAt),
      debitLabel: row.type === 'Dr' ? await singlePrice(amount) : '',
      creditLabel: row.type === 'Cr' ? await singlePrice(amount) : '',
      balanceLabel: await singlePrice(balance),
    })),
  );


  const openingLabel = await singlePrice(opening);

  return (
    <>
      <PageHeader
        title="Ledger Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Ledger Report' }]}
        actions={
          <form
            action={ROUTES['leadger_report.index']}
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <select
              name="account_id"
              defaultValue={accountId ? String(accountId) : ''}
              className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {`${a.name}${a.code ? ` (${a.code})` : ''}`}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="dateFrom"
              defaultValue={from ?? ''}
              className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
            />
            <input
              type="date"
              name="dateTo"
              defaultValue={to ?? ''}
              className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary"
            >
              Search
            </button>
          </form>
        }
      />

      {warning ? (
        <div className="mb-5">
          <FormAlert variant="warning" message={warning} />
        </div>
      ) : null}

      {!account ? (
        <Card title="Ledger">
          <EmptyState message="Select an account to build its ledger." />
        </Card>
      ) : (
        <Card
          title={`${account.name}${account.code ? ` (${account.code})` : ''}`}
          bodyClassName=""
          actions={
            <Link
              href={route('leadger_report.print_view', { slug: account.id })}
              className="text-xs font-medium text-primary hover:text-primary"
            >
              Print view
            </Link>
          }
        >
          <DataTable
            columns={[
              { label: 'Date' },
              { label: 'Voucher' },
              { label: 'Narration' },
              { label: 'Debit' },
              { label: 'Credit' },
              { label: 'Balance' },
            ]}
            isEmpty={false}
          >
            <Tr>
              <Td className="font-medium text-foreground">
                Opening Balance
              </Td>
              <Td>{''}</Td>
              <Td>{''}</Td>
              <Td>{''}</Td>
              <Td>{''}</Td>
              <Td className="text-right">{openingLabel}</Td>
            </Tr>

            {decorated.map((row) => (
              <Tr key={row.id}>
                <Td>{row.dateLabel}</Td>
                <Td>{row.txId ?? '-'}</Td>
                <Td>{row.narration ?? row.voucherNarration ?? '-'}</Td>
                <Td>{row.debitLabel}</Td>
                <Td>{row.creditLabel}</Td>
                <Td className="text-right">{row.balanceLabel}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      )}
    </>
  );
}
