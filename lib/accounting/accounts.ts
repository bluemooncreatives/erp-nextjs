// ---------------------------------------------------------------------------
// Chart of accounts - port of Modules/Account/Entities/ChartAccount.php and
// app/Traits/Accounts.php.
//
// Balance rules, verbatim from `getBalanceAmountAttribute()`:
//   type 1 (Asset) and 3 (Expense)   -> debit  - credit
//   type 2 (Liability), 4 (Income),
//        5 (Equity)                  -> credit - debit
//
// The `code` values below are fixed by the installer seed and are referenced
// directly by the posting logic, exactly as the PHP trait did.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, eq, inArray, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { chartAccounts, transactions, vouchers } from '@/lib/db/schema';
import { endOfWeek, endOfYear, startOfMonth, endOfMonth, startOfWeek, today } from '@/lib/php-date';

/** `account_type($type)` from Helper.php. */
export const AccountType = {
  Asset: 1,
  Liability: 2,
  Expense: 3,
  Income: 4,
  Equity: 5,
} as const;

export function accountTypeName(type: number | string | null): string {
  switch (Number(type)) {
    case 1: return 'Asset';
    case 2: return 'Liability';
    case 3: return 'Expense';
    case 4: return 'Income';
    case 5: return 'Equity';
    default: return '';
  }
}

/** `configuration_group_id` groupings used by the ChartAccount query scopes. */
export const ConfigurationGroup = {
  Cash: 1,
  Bank: 2,
  Receivable: 3,
  Payable: 4,
  Equity: 5,
} as const;

/** Account codes hard-wired into the PHP posting logic (app/Traits/Accounts.php). */
export const AccountCode = {
  Sales: '04-15',
  SalesReturn: '03-23',
  ProductTax: '02-12-13',
  ShippingIncome: '04-16-28',
  ShippingExpense: '01-27',
  OtherPurchaseTax: '01-27',
  Purchase: '01-07',
  PurchaseReturn: '04-24',
  CostOfGoodsSold: '03-19',
  WalkInCustomer: '01-05-25',
  RetainedEarnings: '02-14',
} as const;

/** Root accounts the dashboard totals hang off (ids from the installer seed). */
export const RootAccountId = {
  Cash: 1,
  Bank: 3,
} as const;

export type ChartAccountRow = typeof chartAccounts.$inferSelect;

export async function findAccountByCode(code: string): Promise<ChartAccountRow | null> {
  const [row] = await db
    .select()
    .from(chartAccounts)
    .where(eq(chartAccounts.code, code))
    .limit(1);
  return row ?? null;
}

export async function accountIdByCode(code: string): Promise<number | null> {
  const row = await findAccountByCode(code);
  return row?.id ?? null;
}

export async function findAccount(id: number): Promise<ChartAccountRow | null> {
  const [row] = await db
    .select()
    .from(chartAccounts)
    .where(eq(chartAccounts.id, id))
    .limit(1);
  return row ?? null;
}

/** `AccountFind($contactable_id, $contactable_type)` */
export async function findContactAccount(
  contactableId: number,
  contactableType: string,
): Promise<ChartAccountRow | null> {
  const [row] = await db
    .select()
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.contactableId, contactableId),
        eq(chartAccounts.contactableType, contactableType),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Direct children - `$account->chart_accounts`. */
export async function childAccounts(parentId: number): Promise<ChartAccountRow[]> {
  return db.select().from(chartAccounts).where(eq(chartAccounts.parentId, parentId));
}

/** Accounts matching one of the `configuration_group_id` scopes. */
export async function accountsInGroups(groups: number[]): Promise<ChartAccountRow[]> {
  if (!groups.length) return [];
  return db
    .select()
    .from(chartAccounts)
    .where(inArray(chartAccounts.configurationGroupId, groups));
}

export const paymentAccounts = () =>
  accountsInGroups([ConfigurationGroup.Cash, ConfigurationGroup.Bank]);
export const cashPaymentAccounts = () => accountsInGroups([ConfigurationGroup.Cash]);
export const bankPaymentAccounts = () => accountsInGroups([ConfigurationGroup.Bank]);
export const payableAccounts = () => accountsInGroups([ConfigurationGroup.Payable]);
export const receivableAccounts = () => accountsInGroups([ConfigurationGroup.Receivable]);
export const equityAccounts = () => accountsInGroups([ConfigurationGroup.Equity]);
export const incomeAccounts = () => accountsInGroups([ConfigurationGroup.Payable]);

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

/** Period filters from `Transaction::scopeBalanceAmount()`. */
export type BalancePeriod = 'all' | 'today' | 'week' | 'month' | 'year';

/**
 * Build the period predicate. `year` uses the open accounting period from
 * `time_period_accounts`, as the PHP scope did.
 */
async function periodCondition(period: BalancePeriod): Promise<SQL | undefined> {
  if (period === 'all') return undefined;
  if (period === 'today') {
    return sql`date(${transactions.createdAt}) = ${today()}`;
  }
  if (period === 'week') {
    return sql`${transactions.createdAt} between ${startOfWeek()} and ${endOfWeek()}`;
  }
  if (period === 'month') {
    return sql`${transactions.createdAt} between ${startOfMonth()} and ${endOfMonth()}`;
  }
  // 'year'
  const { openAccountingPeriod } = await import('./periods');
  const tp = await openAccountingPeriod();
  if (!tp) return sql`${transactions.createdAt} between ${startOfMonth()} and ${endOfYear()}`;
  return sql`${transactions.createdAt} between ${tp.startDate} and ${tp.endDate}`;
}

/** Sum of Dr and Cr postings against one account, optionally within a period. */
export async function accountTotals(
  accountId: number,
  period: BalancePeriod = 'all',
): Promise<{ debit: number; credit: number }> {
  const cond = await periodCondition(period);
  const [row] = await db
    .select({
      debit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Dr' then ${transactions.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Cr' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(cond ? and(eq(transactions.accountId, accountId), cond) : eq(transactions.accountId, accountId));

  return { debit: Number(row?.debit ?? 0), credit: Number(row?.credit ?? 0) };
}

/**
 * `$account->BalanceAmount` / `getBalanceAmountByDate($type)`.
 * Sign depends on the account type, per the PHP accessor.
 */
export async function accountBalance(
  account: Pick<ChartAccountRow, 'id' | 'type'>,
  period: BalancePeriod = 'all',
): Promise<number> {
  const { debit, credit } = await accountTotals(account.id, period);
  const type = Number(account.type);
  return type === AccountType.Asset || type === AccountType.Expense
    ? debit - credit
    : credit - debit;
}

/**
 * Balances for many accounts in one query - the PHP code looped and summed in
 * PHP, which issued a query per account.
 */
export async function accountBalances(
  accounts: Array<Pick<ChartAccountRow, 'id' | 'type'>>,
  period: BalancePeriod = 'all',
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (!accounts.length) return result;

  const ids = accounts.map((a) => a.id);
  const cond = await periodCondition(period);

  const rows = await db
    .select({
      accountId: transactions.accountId,
      debit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Dr' then ${transactions.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Cr' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(cond ? and(inArray(transactions.accountId, ids), cond) : inArray(transactions.accountId, ids))
    .groupBy(transactions.accountId);

  const totals = new Map(rows.map((r) => [r.accountId, r]));

  for (const account of accounts) {
    const t = totals.get(account.id);
    const debit = Number(t?.debit ?? 0);
    const credit = Number(t?.credit ?? 0);
    const type = Number(account.type);
    result.set(
      account.id,
      type === AccountType.Asset || type === AccountType.Expense ? debit - credit : credit - debit,
    );
  }
  return result;
}

/**
 * Balance restricted to APPROVED vouchers. `Transaction::scopeApproved()`
 * joined through the polymorphic voucher and required `is_approve = 1`.
 */
export async function approvedAccountBalance(
  account: Pick<ChartAccountRow, 'id' | 'type'>,
  period: BalancePeriod = 'all',
): Promise<number> {
  const cond = await periodCondition(period);
  const { MorphType } = await import('@/lib/db/morph');

  const [row] = await db
    .select({
      debit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Dr' then ${transactions.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${transactions.type} = 'Cr' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .innerJoin(
      vouchers,
      and(
        eq(vouchers.id, transactions.voucherableId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .where(
      cond
        ? and(eq(transactions.accountId, account.id), eq(vouchers.isApprove, 1), cond)
        : and(eq(transactions.accountId, account.id), eq(vouchers.isApprove, 1)),
    );

  const debit = Number(row?.debit ?? 0);
  const credit = Number(row?.credit ?? 0);
  const type = Number(account.type);
  return type === AccountType.Asset || type === AccountType.Expense
    ? debit - credit
    : credit - debit;
}

/** Total across an account and all of its descendants. */
export async function accountTreeBalance(
  rootId: number,
  period: BalancePeriod = 'all',
): Promise<number> {
  const descendants = await accountSubtree(rootId);
  const balances = await accountBalances(descendants, period);
  let total = 0;
  for (const value of balances.values()) total += value;
  return total;
}

/** Every account at or below `rootId`, walking `parent_id` breadth-first. */
export async function accountSubtree(rootId: number): Promise<ChartAccountRow[]> {
  const all = await db.select().from(chartAccounts);
  const byParent = new Map<number, ChartAccountRow[]>();
  for (const row of all) {
    const key = row.parentId ?? 0;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }

  const out: ChartAccountRow[] = [];
  const queue = [...(byParent.get(rootId) ?? [])];
  while (queue.length) {
    const node = queue.shift()!;
    out.push(node);
    queue.push(...(byParent.get(node.id) ?? []));
  }
  return out;
}

/** The full tree, for the Chart of Accounts screen. */
export type AccountTreeNode = ChartAccountRow & { children: AccountTreeNode[] };

export async function accountTree(): Promise<AccountTreeNode[]> {
  const all = await db.select().from(chartAccounts).orderBy(chartAccounts.code);
  const nodes = new Map<number, AccountTreeNode>();
  for (const row of all) nodes.set(row.id, { ...row, children: [] });

  const roots: AccountTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * `VoucherRepository::recieveCategoryAccounts()` - who money can be received
 * from: every customer account (children of account 5, or receivable group) and
 * every posting income account bar `04-16-17` and `04-24`.
 */
export async function receiveFromAccounts(): Promise<ChartAccountRow[]> {
  return db
    .select()
    .from(chartAccounts)
    .where(
      or(
        and(eq(chartAccounts.parentId, 5), eq(chartAccounts.isGroup, 0)),
        eq(chartAccounts.configurationGroupId, ConfigurationGroup.Receivable),
        and(
          eq(chartAccounts.type, String(AccountType.Income)),
          eq(chartAccounts.isGroup, 0),
          notInArray(chartAccounts.code, ['04-16-17', '04-24']),
        ),
      ),
    )
    .orderBy(chartAccounts.code);
}

/** `VoucherRepository::get_recieveByAccount_account()` - cash and bank accounts. */
export async function receiveByAccounts(): Promise<ChartAccountRow[]> {
  return accountsInGroups([ConfigurationGroup.Cash, ConfigurationGroup.Bank]);
}
