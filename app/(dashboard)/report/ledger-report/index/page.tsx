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

  let running = opening;
  const debitPositive = account
    ? Number(account.type) === 1 || Number(account.type) === 4
    : true;

  const decorated = await Promise.all(
    rows.map(async (row) => {
      const amount = Number(row.amount);
      const signed =
        row.type === 'Dr' ? (debitPositive ? amount : -amount) : debitPositive ? -amount : amount;
      running += signed;
      return {
        ...row,
        amount,
        balance: running,
        dateLabel: await dateConvert(row.date ?? row.createdAt),
        debitLabel: row.type === 'Dr' ? await singlePrice(amount) : '',
        creditLabel: row.type === 'Cr' ? await singlePrice(amount) : '',
        balanceLabel: await singlePrice(running),
      };
    }),
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
              className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
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
              className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <input
              type="date"
              name="dateTo"
              defaultValue={to ?? ''}
              className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
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
              className="text-theme-xs font-medium text-brand-500 hover:text-brand-600"
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
              <Td className="font-medium text-gray-700 dark:text-gray-300">
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
