// ---------------------------------------------------------------------------
// Accounting reports.
//
// Ports Modules/Account TransactionController, GeneralLedgerController,
// AccountBalanceController and Modules/Report's income-statement repository:
//
//   Transactions    every posting, filterable by account and date
//   Statement       one account's ledger with a running balance
//   Account Balance a trial-balance style list of every account
//   Profit & Loss   income accounts less expense accounts for a period
// ---------------------------------------------------------------------------

import 'server-only';
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { chartAccounts, transactions, vouchers } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { AccountType } from './accounts';
import { openAccountingPeriod } from './periods';

export type DateRange = { from?: string; to?: string };

function dateCondition(range: DateRange): SQL | undefined {
  if (range.from && range.to) {
    return and(gte(vouchers.date, range.from), lte(vouchers.date, range.to));
  }
  if (range.from) return gte(vouchers.date, range.from);
  if (range.to) return lte(vouchers.date, range.to);
  return undefined;
}

export type TransactionRow = {
  id: number;
  date: string | null;
  txId: string | null;
  voucherType: string | null;
  accountId: number;
  accountName: string | null;
  accountCode: string | null;
  type: string | null;
  amount: number;
  narration: string | null;
  isApprove: number;
  referableType: string | null;
  referableId: number | null;
};

/** `TransactionController@index` - the postings list. */
export async function listTransactions(filters: {
  accountId?: number;
  range?: DateRange;
  approvedOnly?: boolean;
  page?: number;
  perPage?: number;
} = {}): Promise<{
  rows: TransactionRow[];
  total: number;
  page: number;
  perPage: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 50;

  const conditions: SQL[] = [eq(transactions.voucherableType, MorphType.Voucher)];
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.approvedOnly) conditions.push(eq(vouchers.isApprove, 1));
  const dateFilter = dateCondition(filters.range ?? {});
  if (dateFilter) conditions.push(dateFilter);

  const condition = and(...conditions);

  const rows = await db
    .select({
      id: transactions.id,
      date: vouchers.date,
      txId: vouchers.txId,
      voucherType: vouchers.voucherType,
      accountId: transactions.accountId,
      accountName: chartAccounts.name,
      accountCode: chartAccounts.code,
      type: transactions.type,
      amount: transactions.amount,
      narration: transactions.narration,
      isApprove: vouchers.isApprove,
      referableType: vouchers.referableType,
      referableId: vouchers.referableId,
    })
    .from(transactions)
    .innerJoin(vouchers, eq(vouchers.id, transactions.voucherableId))
    .leftJoin(chartAccounts, eq(chartAccounts.id, transactions.accountId))
    .where(condition)
    .orderBy(desc(vouchers.date), desc(transactions.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .innerJoin(vouchers, eq(vouchers.id, transactions.voucherableId))
    .where(condition);

  return {
    rows: rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

export type StatementRow = TransactionRow & { balance: number };

/**
 * `statement.index` - one account's ledger, oldest first, with a running
 * balance signed by the account type (Asset/Expense: Dr increases).
 */
export async function accountStatement(
  accountId: number,
  range: DateRange = {},
): Promise<{ rows: StatementRow[]; closingBalance: number; account: typeof chartAccounts.$inferSelect | null }> {
  const [account] = await db
    .select()
    .from(chartAccounts)
    .where(eq(chartAccounts.id, accountId))
    .limit(1);
  if (!account) return { rows: [], closingBalance: 0, account: null };

  const conditions: SQL[] = [
    eq(transactions.accountId, accountId),
    eq(transactions.voucherableType, MorphType.Voucher),
  ];
  const dateFilter = dateCondition(range);
  if (dateFilter) conditions.push(dateFilter);

  const rows = await db
    .select({
      id: transactions.id,
      date: vouchers.date,
      txId: vouchers.txId,
      voucherType: vouchers.voucherType,
      accountId: transactions.accountId,
      accountName: chartAccounts.name,
      accountCode: chartAccounts.code,
      type: transactions.type,
      amount: transactions.amount,
      narration: transactions.narration,
      isApprove: vouchers.isApprove,
      referableType: vouchers.referableType,
      referableId: vouchers.referableId,
    })
    .from(transactions)
    .innerJoin(vouchers, eq(vouchers.id, transactions.voucherableId))
    .leftJoin(chartAccounts, eq(chartAccounts.id, transactions.accountId))
    .where(and(...conditions))
    .orderBy(asc(vouchers.date), asc(transactions.id));

  const type = Number(account.type);
  const debitPositive = type === AccountType.Asset || type === AccountType.Expense;

  let balance = 0;
  const withBalance: StatementRow[] = rows.map((r) => {
    const amount = Number(r.amount);
    const signed =
      r.type === 'Dr' ? (debitPositive ? amount : -amount) : debitPositive ? -amount : amount;
    balance += signed;
    return { ...r, amount, balance };
  });

  return { rows: withBalance, closingBalance: balance, account };
}

export type AccountBalanceRow = {
  id: number;
  code: string | null;
  name: string;
  type: string;
  isGroup: number;
  parentId: number | null;
  debit: number;
  credit: number;
  balance: number;
};

/**
 * `account.balance.index` - every account with its Dr/Cr totals and balance.
 * One grouped query rather than the per-account loop the PHP ran.
 */
export async function accountBalances(range: DateRange = {}): Promise<AccountBalanceRow[]> {
  const accounts = await db.select().from(chartAccounts).orderBy(chartAccounts.code);

  const conditions: SQL[] = [eq(transactions.voucherableType, MorphType.Voucher)];
  const dateFilter = dateCondition(range);
  if (dateFilter) conditions.push(dateFilter);

  const totals = await db
    .select({
      accountId: transactions.accountId,
      debit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Dr' then ${transactions.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Cr' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .innerJoin(vouchers, eq(vouchers.id, transactions.voucherableId))
    .where(and(...conditions))
    .groupBy(transactions.accountId);

  const byAccount = new Map(totals.map((t) => [t.accountId, t]));

  return accounts.map((account) => {
    const t = byAccount.get(account.id);
    const debit = Number(t?.debit ?? 0);
    const credit = Number(t?.credit ?? 0);
    const type = Number(account.type);
    const balance =
      type === AccountType.Asset || type === AccountType.Expense
        ? debit - credit
        : credit - debit;

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      isGroup: account.isGroup,
      parentId: account.parentId,
      debit,
      credit,
      balance,
    };
  });
}

export type ProfitAndLoss = {
  income: AccountBalanceRow[];
  expense: AccountBalanceRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  from: string | null;
  to: string | null;
};

/**
 * `profit.index` - income accounts less expense accounts.
 * With no range given, the open accounting period is used, as the PHP did.
 */
export async function profitAndLoss(range: DateRange = {}): Promise<ProfitAndLoss> {
  let { from, to } = range;
  if (!from || !to) {
    const period = await openAccountingPeriod();
    from = from ?? period?.startDate ?? undefined;
    to = to ?? period?.endDate ?? undefined;
  }

  const balances = await accountBalances({ from, to });

  const income = balances.filter(
    (b) => Number(b.type) === AccountType.Income && b.isGroup === 0,
  );
  const expense = balances.filter(
    (b) => Number(b.type) === AccountType.Expense && b.isGroup === 0,
  );

  const totalIncome = income.reduce((sum, b) => sum + b.balance, 0);
  const totalExpense = expense.reduce((sum, b) => sum + b.balance, 0);

  return {
    income,
    expense,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    from: from ?? null,
    to: to ?? null,
  };
}

/** The voucher list behind the payment/receive/journal/contra screens. */
export async function listVouchers(filters: {
  paymentType?: string;
  voucherType?: string;
  isApprove?: number;
  range?: DateRange;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const conditions: SQL[] = [];
  if (filters.paymentType) conditions.push(eq(vouchers.paymentType, filters.paymentType));
  if (filters.voucherType) conditions.push(eq(vouchers.voucherType, filters.voucherType));
  if (filters.isApprove != null) conditions.push(eq(vouchers.isApprove, filters.isApprove));
  const dateFilter = dateCondition(filters.range ?? {});
  if (dateFilter) conditions.push(dateFilter);

  const condition = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(vouchers)
    .where(condition)
    .orderBy(desc(vouchers.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(vouchers)
    .where(condition);

  // Attach each voucher's legs so the list can show both sides.
  const ids = rows.map((r) => r.id);
  const legs = ids.length
    ? await db
        .select({
          voucherableId: transactions.voucherableId,
          accountId: transactions.accountId,
          accountName: chartAccounts.name,
          type: transactions.type,
          amount: transactions.amount,
          narration: transactions.narration,
        })
        .from(transactions)
        .leftJoin(chartAccounts, eq(chartAccounts.id, transactions.accountId))
        .where(
          and(
            inArray(transactions.voucherableId, ids),
            eq(transactions.voucherableType, MorphType.Voucher),
          ),
        )
    : [];

  const legsByVoucher = new Map<number, typeof legs>();
  for (const leg of legs) {
    const list = legsByVoucher.get(leg.voucherableId) ?? [];
    list.push(leg);
    legsByVoucher.set(leg.voucherableId, list);
  }

  return {
    rows: rows.map((v) => ({ ...v, legs: legsByVoucher.get(v.id) ?? [] })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

/** Accounts that can be posted to, for the voucher forms. */
export async function postableAccounts() {
  return db
    .select({
      id: chartAccounts.id,
      name: chartAccounts.name,
      code: chartAccounts.code,
      type: chartAccounts.type,
      configurationGroupId: chartAccounts.configurationGroupId,
    })
    .from(chartAccounts)
    .where(and(eq(chartAccounts.isGroup, 0), eq(chartAccounts.status, 1)))
    .orderBy(chartAccounts.code);
}
