// The ledger statement behind both `leadger_report.index` and
// `leadger_report.print_view`. The two Laravel controller methods repeat the
// same query, guards and running balance; keeping one implementation here is
// what stops the screen and its print sheet drifting apart.

import 'server-only';
import { findAccount } from '@/lib/accounting/accounts';
import { ledgerOpeningBalance, ledgerRows } from '@/lib/reports/statements';
import { toDateString } from '@/lib/php-date';

export type LedgerParams = {
  account_id?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function ledgerStatement(params: LedgerParams) {
  const accountId = Number(params.account_id) || null;
  const from = toDateString(params.dateFrom);
  const to = toDateString(params.dateTo);

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

  // Asset and expense accounts read debits as increases; the rest read credits.
  const debitPositive = account
    ? Number(account.type) === 1 || Number(account.type) === 4
    : true;

  // The running balance is worked out before any formatting, because the
  // formatting pass awaits and would resume out of order.
  const withBalances = rows.reduce<
    Array<{ row: (typeof rows)[number]; amount: number; balance: number }>
  >((acc, row) => {
    const amount = Number(row.amount);
    const signed =
      row.type === 'Dr' ? (debitPositive ? amount : -amount) : debitPositive ? -amount : amount;
    const balance = (acc.length ? acc[acc.length - 1].balance : opening) + signed;
    acc.push({ row, amount, balance });
    return acc;
  }, []);

  const closing = withBalances.length ? withBalances[withBalances.length - 1].balance : opening;
  const totalDebit = rows
    .filter((row) => row.type === 'Dr')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const totalCredit = rows
    .filter((row) => row.type === 'Cr')
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    accountId,
    account,
    from,
    to,
    warning,
    rows,
    withBalances,
    opening,
    closing,
    totalDebit,
    totalCredit,
  };
}
