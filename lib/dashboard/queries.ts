// ---------------------------------------------------------------------------
// Dashboard data - port of app/Traits/Dashboard.php plus the dashboard methods
// on SaleRepository, PurchaseOrderRepository, VoucherRepository and
// StockTransferRepository.
//
// Every figure is scoped by the session's branch, using the PHP convention that
// `showroom_id == 1` means "all branches" and anything else narrows to that
// branch.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  chartAccounts,
  payments,
  productSku,
  purchaseOrders,
  sales,
  showRooms,
  stockReports,
  toDos,
  vouchers,
  holidays,
  events,
  expenses,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import {
  accountBalance,
  accountTreeBalance,
  ConfigurationGroup,
  RootAccountId,
} from '@/lib/accounting/accounts';
import { openAccountingPeriod } from '@/lib/accounting/periods';
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  today,
} from '@/lib/php-date';

/** The PHP treated branch 1 as "the whole business". */
export const ALL_BRANCHES = 1;

export type DashboardScope = {
  /** session('showroom_id') */
  showroomId: number | null;
};

export function isAllBranches(scope: DashboardScope): boolean {
  return scope.showroomId === ALL_BRANCHES || scope.showroomId == null;
}

/** `Payment($type)` / `Expense($type)` scopes - the dashboard's period filter. */
export type Period = 'all' | 'today' | 'week' | 'month' | 'year';

async function periodRange(period: Period): Promise<{ from: string; to: string } | null> {
  if (period === 'all') return null;
  if (period === 'today') return { from: today(), to: today() };
  if (period === 'week') return { from: startOfWeek(), to: endOfWeek() };
  if (period === 'month') return { from: startOfMonth(), to: endOfMonth() };
  const tp = await openAccountingPeriod();
  if (!tp?.startDate || !tp?.endDate) return null;
  return { from: tp.startDate, to: tp.endDate };
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

function saleBranchCondition(scope: DashboardScope): SQL | undefined {
  if (isAllBranches(scope)) return undefined;
  return and(
    eq(sales.saleableType, MorphType.ShowRoom),
    eq(sales.saleableId, scope.showroomId!),
  );
}

/** `approvedSales()` */
export async function approvedSalesCount(scope: DashboardScope): Promise<number> {
  const branch = saleBranchCondition(scope);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sales)
    .where(branch ? and(eq(sales.isApproved, 1), branch) : eq(sales.isApproved, 1));
  return Number(row?.count ?? 0);
}

/**
 * `salePayments($type)` - payments against approved sales.
 * The dashboard cards sum `amount - return_amount` over the result.
 */
export async function salePaymentTotals(
  scope: DashboardScope,
  period: Period = 'all',
): Promise<{ amount: number; returnAmount: number; net: number }> {
  const range = await periodRange(period);
  const conditions: SQL[] = [
    eq(payments.payableType, MorphType.Sale),
    eq(sales.isApproved, 1),
  ];
  if (!isAllBranches(scope)) {
    conditions.push(eq(sales.saleableType, MorphType.ShowRoom));
    conditions.push(eq(sales.saleableId, scope.showroomId!));
  }
  if (range) {
    conditions.push(gte(sales.date, range.from));
    conditions.push(lte(sales.date, range.to));
  }

  const [row] = await db
    .select({
      amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      returnAmount: sql<number>`coalesce(sum(${payments.returnAmount}), 0)`,
    })
    .from(payments)
    .innerJoin(sales, eq(sales.id, payments.payableId))
    .where(and(...conditions));

  const amount = Number(row?.amount ?? 0);
  const returnAmount = Number(row?.returnAmount ?? 0);
  return { amount, returnAmount, net: amount - returnAmount };
}

/** `saleTotalPayments($type)` - sum of `payable_amount`. */
export async function saleTotalPayable(
  scope: DashboardScope,
  period: Period = 'all',
): Promise<number> {
  const range = await periodRange(period);
  const conditions: SQL[] = [];
  const branch = saleBranchCondition(scope);
  if (branch) conditions.push(branch);
  if (range) {
    conditions.push(gte(sales.date, range.from));
    conditions.push(lte(sales.date, range.to));
  }

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${sales.payableAmount}), 0)` })
    .from(sales)
    .where(conditions.length ? and(...conditions) : undefined);
  return Number(row?.total ?? 0);
}

/** `dueList($type)` - approved sales that are not fully paid. */
export async function saleDueList(scope: DashboardScope, limit?: number) {
  const conditions: SQL[] = [eq(sales.isApproved, 1), ne(sales.status, 1)];
  const branch = saleBranchCondition(scope);
  if (branch) conditions.push(branch);

  const query = db
    .select({
      id: sales.id,
      invoiceNo: sales.invoiceNo,
      date: sales.date,
      customerId: sales.customerId,
      agentUserId: sales.agentUserId,
      payableAmount: sales.payableAmount,
      status: sales.status,
    })
    .from(sales)
    .where(and(...conditions))
    .orderBy(desc(sales.id));

  return limit ? query.limit(limit) : query;
}

/** `dailySales()` - one row per day of the current month. */
export async function dailySales(scope: DashboardScope) {
  const conditions: SQL[] = [
    eq(sales.isApproved, 1),
    gte(sales.date, startOfMonth()),
    lte(sales.date, endOfMonth()),
  ];
  const branch = saleBranchCondition(scope);
  if (branch) conditions.push(branch);

  return db
    .select({
      day: sql<number>`day(${sales.date})`,
      totalSell: sql<number>`coalesce(sum(${sales.payableAmount}), 0)`,
    })
    .from(sales)
    .where(and(...conditions))
    .groupBy(sql`day(${sales.date})`)
    .orderBy(sql`day(${sales.date}) asc`);
}

/** `monthlySales()` - one row per month of the current year. */
export async function monthlySales(scope: DashboardScope) {
  const year = new Date().getUTCFullYear();
  const conditions: SQL[] = [
    eq(sales.isApproved, 1),
    sql`year(${sales.date}) = ${year}`,
  ];
  const branch = saleBranchCondition(scope);
  if (branch) conditions.push(branch);

  return db
    .select({
      month: sql<number>`month(${sales.date})`,
      monthName: sql<string>`date_format(${sales.date}, '%b')`,
      totalSell: sql<number>`coalesce(sum(${sales.payableAmount}), 0)`,
    })
    .from(sales)
    .where(and(...conditions))
    .groupBy(sql`month(${sales.date})`, sql`date_format(${sales.date}, '%b')`)
    .orderBy(sql`month(${sales.date}) asc`);
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

/** `approvePurchase()` - received (status 1) purchase orders. */
export async function approvedPurchaseCount(scope: DashboardScope): Promise<number> {
  const conditions: SQL[] = [eq(purchaseOrders.status, 1)];
  if (!isAllBranches(scope)) {
    conditions.push(eq(purchaseOrders.purchasableType, MorphType.ShowRoom));
    conditions.push(eq(purchaseOrders.purchasableId, scope.showroomId!));
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(purchaseOrders)
    .where(and(...conditions));
  return Number(row?.count ?? 0);
}

/** `purchasePayments($type)` - the dashboard sums payable over these orders. */
export async function purchaseTotals(
  scope: DashboardScope,
): Promise<{ amount: number; returnAmount: number; net: number }> {
  const conditions: SQL[] = [];
  if (isAllBranches(scope)) {
    conditions.push(eq(purchaseOrders.status, 1));
  } else {
    conditions.push(eq(purchaseOrders.purchasableType, MorphType.ShowRoom));
    conditions.push(eq(purchaseOrders.purchasableId, scope.showroomId!));
  }

  const [row] = await db
    .select({
      amount: sql<number>`coalesce(sum(${purchaseOrders.payableAmount}), 0)`,
    })
    .from(purchaseOrders)
    .where(and(...conditions));

  const amount = Number(row?.amount ?? 0);
  return { amount, returnAmount: 0, net: amount };
}

/** `purchaseDue($type)` - payments against received purchase orders. */
export async function purchasePaymentTotals(
  scope: DashboardScope,
  period: Period = 'all',
): Promise<{ amount: number; returnAmount: number; net: number }> {
  const range = await periodRange(period);
  const conditions: SQL[] = [
    eq(payments.payableType, MorphType.PurchaseOrder),
    eq(purchaseOrders.status, 1),
  ];
  if (!isAllBranches(scope)) {
    conditions.push(eq(purchaseOrders.purchasableType, MorphType.ShowRoom));
    conditions.push(eq(purchaseOrders.purchasableId, scope.showroomId!));
  }
  if (range) {
    conditions.push(gte(purchaseOrders.date, range.from));
    conditions.push(lte(purchaseOrders.date, range.to));
  }

  const [row] = await db
    .select({
      amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      returnAmount: sql<number>`coalesce(sum(${payments.returnAmount}), 0)`,
    })
    .from(payments)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, payments.payableId))
    .where(and(...conditions));

  const amount = Number(row?.amount ?? 0);
  const returnAmount = Number(row?.returnAmount ?? 0);
  return { amount, returnAmount, net: amount - returnAmount };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

/**
 * `VoucherRepository::expenses($type)` - approved vouchers that have an expense
 * record attached.
 */
export async function expenseTotal(
  scope: DashboardScope,
  period: Period = 'all',
): Promise<number> {
  const range = await periodRange(period);
  const conditions: SQL[] = [eq(vouchers.isApprove, 1)];
  if (range) {
    conditions.push(gte(vouchers.date, range.from));
    conditions.push(lte(vouchers.date, range.to));
  }
  if (!isAllBranches(scope)) {
    conditions.push(eq(vouchers.referableType, MorphType.Sale));
  }

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${vouchers.amount}), 0)` })
    .from(vouchers)
    .innerJoin(expenses, eq(expenses.voucherId, vouchers.id))
    .where(and(...conditions));

  return Number(row?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Cash and bank
// ---------------------------------------------------------------------------

/** `totalBank($type)` - the balance of every child of the Bank root account. */
export async function totalBank(period: Period = 'all'): Promise<number> {
  return accountTreeBalance(RootAccountId.Bank, period);
}

/**
 * `totalCash($type)` - children of the Cash root account that belong to the
 * current branch (`contactable_*` pointing at the ShowRoom).
 */
export async function totalCash(
  scope: DashboardScope,
  period: Period = 'all',
): Promise<number> {
  const accounts = await db
    .select({ id: chartAccounts.id, type: chartAccounts.type })
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.parentId, RootAccountId.Cash),
        eq(chartAccounts.contactableType, MorphType.ShowRoom),
        scope.showroomId != null
          ? eq(chartAccounts.contactableId, scope.showroomId)
          : sql`1 = 1`,
      ),
    );

  let total = 0;
  for (const account of accounts) {
    total += await accountBalance(account, period);
  }
  return total;
}

/** Every cash/bank account, for the payment-account pickers. */
export async function paymentAccountOptions() {
  return db
    .select({
      id: chartAccounts.id,
      name: chartAccounts.name,
      code: chartAccounts.code,
      group: chartAccounts.configurationGroupId,
    })
    .from(chartAccounts)
    .where(
      inArray(chartAccounts.configurationGroupId, [
        ConfigurationGroup.Cash,
        ConfigurationGroup.Bank,
      ]),
    )
    .orderBy(chartAccounts.name);
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/** `productQuantity()` - total stock per branch, for the dashboard chart. */
export async function stockByBranch() {
  const rows = await db
    .select({
      id: showRooms.id,
      name: showRooms.name,
      total: sql<number>`coalesce(sum(cast(${stockReports.stock} as decimal(20,2))), 0)`,
    })
    .from(showRooms)
    .leftJoin(
      stockReports,
      and(
        eq(stockReports.houseableId, showRooms.id),
        eq(stockReports.houseableType, MorphType.ShowRoom),
      ),
    )
    .where(eq(showRooms.status, 1))
    .groupBy(showRooms.id, showRooms.name)
    .orderBy(showRooms.id);

  return rows.map((r) => ({ ...r, total: Number(r.total) }));
}

/**
 * `suggestList()` - SKUs whose on-hand has fallen to or below the alert level.
 * `stock_reports.stock` is a VARCHAR, so it is cast for the comparison.
 */
export async function stockAlerts(scope: DashboardScope, limit = 10) {
  const conditions: SQL[] = [
    sql`${productSku.alertQuantity} >= cast(${stockReports.stock} as decimal(20,2))`,
  ];
  if (!isAllBranches(scope)) {
    conditions.push(eq(stockReports.houseableType, MorphType.ShowRoom));
    conditions.push(eq(stockReports.houseableId, scope.showroomId!));
  }

  return db
    .select({
      id: stockReports.id,
      productSkuId: stockReports.productSkuId,
      stock: stockReports.stock,
      alertQuantity: productSku.alertQuantity,
      sku: productSku.sku,
      houseableId: stockReports.houseableId,
      houseableType: stockReports.houseableType,
    })
    .from(stockReports)
    .innerJoin(productSku, eq(productSku.id, stockReports.productSkuId))
    .where(and(...conditions))
    .orderBy(desc(stockReports.id))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// To-dos, holidays and events (the dashboard calendar)
// ---------------------------------------------------------------------------

/** `ToDo::all()` */
export async function todoList() {
  return db.select().from(toDos).orderBy(desc(toDos.id));
}

/**
 * `calendarEvents()` - holidays plus events, normalised to FullCalendar's
 * shape. Holiday `type = 1` stores a 'from,to' pair in `date`, and the PHP
 * added a day to the end so the range renders inclusively.
 */
export type CalendarEvent = {
  title: string;
  description: string | null;
  date?: string;
  start?: string;
  end?: string;
  url?: string | null;
};

export async function calendarEvents(
  /** Role name for `roleWiseEvents()`; null for system users, who see all. */
  roleName: string | null,
): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = [];

  const holidayRows = await db.select().from(holidays);
  for (const holiday of holidayRows) {
    const base: CalendarEvent = {
      title: holiday.name ?? '',
      description: holiday.name ?? '',
      url: null,
    };
    if (holiday.type === 0) {
      out.push({ ...base, date: holiday.date ?? undefined });
    } else {
      const [from, to] = String(holiday.date ?? '').split(',');
      out.push({ ...base, start: from, end: addOneDay(to) });
    }
  }

  // `roleWiseEvents()` - events addressed to everyone or to this user's role.
  // System users (roleName null) see every event.
  const eventRows =
    roleName == null
      ? await db.select().from(events)
      : await db
          .select()
          .from(events)
          .where(
            or(eq(events.forWhom, 'all'), eq(events.forWhom, roleName)),
          );

  for (const event of eventRows) {
    out.push({
      title: event.title ?? '',
      start: event.fromDate ?? undefined,
      end: addOneDay(event.toDate),
      description: event.description ?? null,
      url: event.image ?? null,
    });
  }

  return out;
}

function addOneDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Profit charts
// ---------------------------------------------------------------------------

/**
 * The profit charts compare the cost-of-goods postings (account 19) against the
 * branch's own account, grouped by day or month.
 *
 * Account 19 is the seeded Cost of Goods Sold account the PHP referenced by id.
 */
const COST_OF_GOODS_ACCOUNT_ID = 19;

async function voucherSumsByDay(accountIds: number[], from: string, to: string) {
  if (!accountIds.length) return [];
  const { transactions } = await import('@/lib/db/schema');
  return db
    .select({
      day: sql<number>`day(${vouchers.date})`,
      date: vouchers.date,
      saleAmount: sql<number>`coalesce(sum(${vouchers.amount}), 0)`,
    })
    .from(vouchers)
    .innerJoin(
      transactions,
      and(
        eq(transactions.voucherableId, vouchers.id),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .where(
      and(
        eq(transactions.type, 'Dr'),
        inArray(transactions.accountId, accountIds),
        gte(vouchers.date, from),
        lte(vouchers.date, to),
      ),
    )
    .groupBy(sql`day(${vouchers.date})`, vouchers.date)
    .orderBy(asc(sql`day(${vouchers.date})`));
}

async function voucherSumsByMonth(accountIds: number[], year: number) {
  if (!accountIds.length) return [];
  const { transactions } = await import('@/lib/db/schema');
  return db
    .select({
      month: sql<number>`month(${vouchers.date})`,
      monthName: sql<string>`date_format(${vouchers.date}, '%b')`,
      saleAmount: sql<number>`coalesce(sum(${vouchers.amount}), 0)`,
    })
    .from(vouchers)
    .innerJoin(
      transactions,
      and(
        eq(transactions.voucherableId, vouchers.id),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .where(
      and(
        eq(transactions.type, 'Dr'),
        inArray(transactions.accountId, accountIds),
        sql`year(${vouchers.date}) = ${year}`,
      ),
    )
    .groupBy(sql`month(${vouchers.date})`, sql`date_format(${vouchers.date}, '%b')`)
    .orderBy(asc(sql`month(${vouchers.date})`));
}

/** `currentShowroom()` - the chart account ids backing the branch(es) in scope. */
export async function branchAccountIds(scope: DashboardScope): Promise<number[]> {
  if (isAllBranches(scope)) {
    const rows = await db
      .select({ id: chartAccounts.id })
      .from(chartAccounts)
      .where(eq(chartAccounts.contactableType, MorphType.ShowRoom));
    return rows.map((r) => r.id);
  }

  const rows = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.contactableType, MorphType.ShowRoom),
        eq(chartAccounts.contactableId, scope.showroomId!),
      ),
    );
  return rows.map((r) => r.id);
}

export type ProfitSeries = {
  labels: string[];
  mainAmount: number[];
  saleAmount: number[];
};

export async function profitSeries(
  scope: DashboardScope,
  range: 'daily' | 'weekly' | 'monthly' | 'yearly',
): Promise<ProfitSeries> {
  const branchAccounts = await branchAccountIds(scope);
  const year = new Date().getUTCFullYear();

  if (range === 'yearly') {
    const main = await voucherSumsByMonth([COST_OF_GOODS_ACCOUNT_ID], year);
    const total = await voucherSumsByMonth(branchAccounts, year);
    const labels = Array.from(
      new Set([...main.map((m) => m.monthName), ...total.map((t) => t.monthName)]),
    );
    return {
      labels,
      mainAmount: labels.map(
        (l) => Number(main.find((m) => m.monthName === l)?.saleAmount ?? 0),
      ),
      saleAmount: labels.map(
        (l) => Number(total.find((t) => t.monthName === l)?.saleAmount ?? 0),
      ),
    };
  }

  const { from, to } =
    range === 'daily'
      ? { from: today(), to: today() }
      : range === 'weekly'
        ? { from: startOfWeek(), to: endOfWeek() }
        : { from: startOfMonth(), to: endOfMonth() };

  const main = await voucherSumsByDay([COST_OF_GOODS_ACCOUNT_ID], from, to);
  const total = await voucherSumsByDay(branchAccounts, from, to);

  const labels = Array.from(
    new Set([
      ...main.map((m) => String(m.date ?? m.day)),
      ...total.map((t) => String(t.date ?? t.day)),
    ]),
  ).sort();

  return {
    labels,
    mainAmount: labels.map(
      (l) => Number(main.find((m) => String(m.date ?? m.day) === l)?.saleAmount ?? 0),
    ),
    saleAmount: labels.map(
      (l) => Number(total.find((t) => String(t.date ?? t.day) === l)?.saleAmount ?? 0),
    ),
  };
}
