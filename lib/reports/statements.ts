// ---------------------------------------------------------------------------
// Accounting statements - port of Modules/Report's IncomeStatement,
// BalanceStatement, CashFlow and Ledger repositories, plus the chart-account
// helpers they leaned on (`expenseAccountList`, `dailyIncome`, ...).
//
// The PHP summed a `transactions` relation constrained to the accounting
// period; these run one grouped query instead, over the same rows.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  chartAccounts,
  openingBalanceHistories,
  timePeriodAccounts,
  transactions,
  vouchers,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { AccountType, AccountCode } from '@/lib/accounting/accounts';
import { today } from '@/lib/php-date';

/** The Sales account the income statement starts from (`04-15`). */
const SALES_CODE = AccountCode.Sales;
const COGS_CODE = AccountCode.CostOfGoodsSold;

export type PeriodRange = { startDate: string; endDate: string };

/** A period's own window - the open one runs to today, as the PHP did. */
export async function periodRange(timePeriodId: number): Promise<PeriodRange | null> {
  const [period] = await db
    .select()
    .from(timePeriodAccounts)
    .where(eq(timePeriodAccounts.id, timePeriodId))
    .limit(1);
  if (!period?.startDate) return null;

  return {
    startDate: period.startDate,
    endDate: period.endDate ?? today(),
  };
}

function approvedInRange(range: PeriodRange): SQL[] {
  return [
    eq(transactions.voucherableType, MorphType.Voucher),
    eq(vouchers.isApprove, 1),
    gte(vouchers.date, range.startDate),
    lte(vouchers.date, range.endDate),
  ];
}

/** `IncomeStatementReportRepository::TransactionBalance($account_id, $type)` */
export async function transactionBalance(
  accountId: number,
  type: 'Dr' | 'Cr',
  range: PeriodRange,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(vouchers, eq(vouchers.id, transactions.voucherableId))
    .where(
      and(
        ...approvedInRange(range),
        eq(transactions.accountId, accountId),
        eq(transactions.type, type),
      ),
    );
  return Number(row?.total ?? 0);
}

/** `saleTransactionBalance()` - every leg on the Sales account, both sides. */
export async function saleTransactionBalance(range: PeriodRange): Promise<number> {
  const [sales] = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(eq(chartAccounts.code, SALES_CODE))
    .limit(1);
  if (!sales) return 0;

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(vouchers, eq(vouchers.id, transactions.voucherableId))
    .where(and(...approvedInRange(range), eq(transactions.accountId, sales.id)));
  return Number(row?.total ?? 0);
}

/** `costFoGoodsTransactionBalance()` - the Dr side of Cost of Goods Sold. */
export async function costOfGoodsBalance(range: PeriodRange): Promise<number> {
  const [cogs] = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(eq(chartAccounts.code, COGS_CODE))
    .limit(1);
  if (!cogs) return 0;
  return transactionBalance(cogs.id, 'Dr', range);
}

export type StatementAccount = {
  id: number;
  code: string | null;
  name: string;
  debit: number;
  credit: number;
  balance: number;
};

/**
 * `expenseAccountList()` / `incomeAccountList()` - the accounts of one type
 * that have movement in the period, with their totals.
 */
export async function statementAccounts(
  accountType: number,
  range: PeriodRange,
): Promise<StatementAccount[]> {
  const rows = await db
    .select({
      id: chartAccounts.id,
      code: chartAccounts.code,
      name: chartAccounts.name,
      debit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Dr' then ${transactions.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Cr' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(chartAccounts)
    .innerJoin(transactions, eq(transactions.accountId, chartAccounts.id))
    .innerJoin(vouchers, eq(vouchers.id, transactions.voucherableId))
    .where(and(...approvedInRange(range), eq(chartAccounts.type, String(accountType))))
    .groupBy(chartAccounts.id, chartAccounts.code, chartAccounts.name)
    .orderBy(asc(chartAccounts.code));

  return rows.map((row) => {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    // Expenses read Dr - Cr; income reads Cr - Dr.
    const balance =
      accountType === AccountType.Expense || accountType === AccountType.Asset
        ? debit - credit
        : credit - debit;
    return { id: row.id, code: row.code, name: row.name, debit, credit, balance };
  });
}

export type IncomeStatement = {
  range: PeriodRange;
  sales: number;
  costOfGoods: number;
  grossProfit: number;
  income: StatementAccount[];
  expense: StatementAccount[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

/** `IncomeStateMentController@index` */
export async function incomeStatement(timePeriodId: number): Promise<IncomeStatement | null> {
  const range = await periodRange(timePeriodId);
  if (!range) return null;

  const [sales, costOfGoods, income, expense] = await Promise.all([
    saleTransactionBalance(range),
    costOfGoodsBalance(range),
    statementAccounts(AccountType.Income, range),
    statementAccounts(AccountType.Expense, range),
  ]);

  // The four accounts the gross profit is already built from are excluded.
  const incomeRows = income.filter(
    (a) => a.code !== AccountCode.Sales && a.code !== AccountCode.PurchaseReturn,
  );
  const expenseRows = expense.filter(
    (a) => a.code !== AccountCode.CostOfGoodsSold && a.code !== AccountCode.SalesReturn,
  );

  const totalIncome = incomeRows.reduce((sum, a) => sum + a.balance, 0);
  const totalExpense = expenseRows.reduce((sum, a) => sum + a.balance, 0);
  const grossProfit = sales - costOfGoods;

  return {
    range,
    sales,
    costOfGoods,
    grossProfit,
    income: incomeRows,
    expense: expenseRows,
    totalIncome,
    totalExpense,
    netProfit: grossProfit - totalExpense + totalIncome,
  };
}

/** `dailyExpense($date)` / `dailyIncome($date)` - one day's movement. */
export async function dailyStatement(date: string) {
  const range = { startDate: date, endDate: date };
  const [income, expense] = await Promise.all([
    statementAccounts(AccountType.Income, range),
    statementAccounts(AccountType.Expense, range),
  ]);
  return { date, income, expense };
}

/**
 * `BalanceStatementReportRepository::openingBalancesList($timePeriod)`.
 *
 * The PHP read the *next* period's default opening balances - the figures the
 * close carried forward - and joined them to their accounts. That table has no
 * `time_period_account_id` column in the shipped schema, so the rows are
 * matched by the next period's start date instead.
 */
export async function balanceStatement(timePeriodId: number) {
  const [next] = await db
    .select()
    .from(timePeriodAccounts)
    .where(sql`${timePeriodAccounts.id} > ${timePeriodId}`)
    .orderBy(asc(timePeriodAccounts.id))
    .limit(1);
  if (!next?.startDate) return [];

  const rows = await db
    .select({
      history: openingBalanceHistories,
      accountName: chartAccounts.name,
      accountCode: chartAccounts.code,
      accountType: chartAccounts.type,
    })
    .from(openingBalanceHistories)
    .leftJoin(chartAccounts, eq(chartAccounts.id, openingBalanceHistories.accountId))
    .where(
      and(
        eq(openingBalanceHistories.isDefault, 1),
        sql`${openingBalanceHistories.date} <= ${next.startDate}`,
      ),
    )
    .orderBy(desc(openingBalanceHistories.id));

  return rows;
}

export type CashFlowRow = {
  id: number;
  type: string | null;
  amount: number;
  date: string | null;
  narration: string | null;
  txId: string | null;
  accountName: string | null;
  accountCode: string | null;
};

/** `CashFlowReportRepository::payments()` / `::recieves()` */
export async function cashFlowRows(
  paymentType: 'voucher_payment' | 'voucher_recieve',
  side: 'Dr' | 'Cr',
  from: string,
  to: string,
): Promise<CashFlowRow[]> {
  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: vouchers.date,
      narration: vouchers.narration,
      txId: vouchers.txId,
      accountName: chartAccounts.name,
      accountCode: chartAccounts.code,
    })
    .from(transactions)
    .innerJoin(
      vouchers,
      and(
        eq(vouchers.id, transactions.voucherableId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .leftJoin(chartAccounts, eq(chartAccounts.id, transactions.accountId))
    .where(
      and(
        eq(vouchers.paymentType, paymentType),
        gte(vouchers.date, from),
        lte(vouchers.date, to),
        eq(transactions.type, side),
      ),
    )
    .orderBy(desc(transactions.id));

  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/**
 * `IncomeStatementReportRepository::DateWiseTransactionBalanceBranch()` and its
 * date-range sibling - the branch income/expense report.
 */
export async function branchTransactions(
  accountIds: number[],
  from: string,
  to: string,
) {
  if (!accountIds.length) return [];

  return db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      amount: transactions.amount,
      date: vouchers.date,
      narration: vouchers.narration,
      accountName: chartAccounts.name,
      accountCode: chartAccounts.code,
    })
    .from(transactions)
    .innerJoin(
      vouchers,
      and(
        eq(vouchers.id, transactions.voucherableId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .leftJoin(chartAccounts, eq(chartAccounts.id, transactions.accountId))
    .where(
      and(eq(vouchers.isApprove, 1), gte(vouchers.date, from), lte(vouchers.date, to), inArray(transactions.accountId, accountIds)),
    )
    .orderBy(desc(transactions.id));
}

/** `ChartAccountRepository::showroomAccounts()` */
export async function showroomAccountIds(): Promise<number[]> {
  const rows = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(eq(chartAccounts.contactableType, MorphType.ShowRoom));
  return rows.map((r) => r.id);
}

/** The accounting periods the report filters offer. */
export async function reportPeriods() {
  return db.select().from(timePeriodAccounts).orderBy(desc(timePeriodAccounts.id));
}

/** `LedgerReportRepository` - every posting account, for the ledger picker. */
export async function ledgerAccounts() {
  return db
    .select()
    .from(chartAccounts)
    .where(eq(chartAccounts.isGroup, 0))
    .orderBy(asc(chartAccounts.code));
}

/**
 * `LedgerReportRepository::balanceBeforeDate()` - the opening balance the
 * ledger starts from. Asset (1) and Income (4) accounts read Dr - Cr; the rest
 * read Cr - Dr, which is the PHP's own (unusual) split.
 */
export async function ledgerOpeningBalance(
  accountId: number,
  accountType: number,
  before: string,
): Promise<number> {
  const [row] = await db
    .select({
      debit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Dr' then ${transactions.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Cr' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        sql`${transactions.createdAt} < ${`${before} 23:59:59`}`,
      ),
    );

  const debit = Number(row?.debit ?? 0);
  const credit = Number(row?.credit ?? 0);
  return accountType === 1 || accountType === 4 ? debit - credit : credit - debit;
}

/** `LedgerReportRepository::search($dateFrom, $dateTo, $account_id)` */
export async function ledgerRows(
  accountId: number,
  from: string | null,
  to: string | null,
) {
  const where: SQL[] = [eq(transactions.accountId, accountId)];
  if (from && to) {
    where.push(sql`${transactions.createdAt} >= ${`${from} 00:00:00`}`);
    where.push(sql`${transactions.createdAt} <= ${`${to} 23:59:59`}`);
  }

  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      narration: transactions.narration,
      createdAt: transactions.createdAt,
      date: vouchers.date,
      txId: vouchers.txId,
      voucherNarration: vouchers.narration,
      isApprove: vouchers.isApprove,
    })
    .from(transactions)
    .leftJoin(
      vouchers,
      and(
        eq(vouchers.id, transactions.voucherableId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .where(and(...where))
    .orderBy(asc(transactions.id));
}

/**
 * The "history" screens (staff, customer, supplier) all render one contact's
 * chart-account ledger with a running balance that starts at their opening
 * balance and moves Dr up / Cr down, regardless of account type.
 */
export async function contactableLedger(
  contactableType: string,
  contactableId: number,
  openingBalance: number,
) {
  const [account] = await db
    .select({ id: chartAccounts.id, name: chartAccounts.name, code: chartAccounts.code })
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.contactableType, contactableType),
        eq(chartAccounts.contactableId, contactableId),
      ),
    )
    .limit(1);

  if (!account) {
    return { account: null, rows: [], opening: openingBalance, closing: openingBalance };
  }

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      narration: transactions.narration,
      createdAt: transactions.createdAt,
      date: vouchers.date,
      txId: vouchers.txId,
      voucherNarration: vouchers.narration,
      isApprove: vouchers.isApprove,
    })
    .from(transactions)
    .leftJoin(
      vouchers,
      and(
        eq(vouchers.id, transactions.voucherableId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .where(eq(transactions.accountId, account.id))
    .orderBy(asc(transactions.id));

  let balance = openingBalance;
  const withBalance = rows.map((row) => {
    const amount = Number(row.amount);
    balance += row.type === 'Dr' ? amount : -amount;
    return { ...row, amount, balance };
  });

  return { account, rows: withBalance, opening: openingBalance, closing: balance };
}
