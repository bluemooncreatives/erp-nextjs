// ---------------------------------------------------------------------------
// Opening balances - port of
// Modules/Account/Repositories/OpeningBalanceHistoryRepository.php.
//
// Two tables are involved:
//   `opening_balance_histories` - one row per account per period, tagged
//       `acc_type` = 'asset' | 'liability'
//   `type_opening_balances`     - a per-contact record of the figure entered,
//       tagged `type` = 'customer' | 'supplier'
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import {
  chartAccounts,
  openingBalanceHistories,
  timePeriodAccounts,
  typeOpeningBalances,
} from '@/lib/db/schema';
import { AccountType } from './accounts';
import { today, toDateString } from '@/lib/php-date';

type Tx = MySql2Database<typeof schema>;

export const AccTypeAsset = 'asset';
export const AccTypeLiability = 'liability';

/**
 * The seeded control account every contact's opening balance is offset
 * against (`ChartAccount::where('code', '02-09-11')`).
 */
export const OPENING_BALANCE_CONTROL_CODE = '02-09-11';

export async function openingBalanceControlAccountId(
  conn: Tx = db,
): Promise<number | null> {
  const [row] = await conn
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(eq(chartAccounts.code, OPENING_BALANCE_CONTROL_CODE))
    .limit(1);
  return row?.id ?? null;
}

/** `create(['account_id', 'amount', 'date', 'type'])` */
export async function createOpeningBalance(
  data: {
    accountId: number;
    amount: number;
    date: string;
    accType: string;
    isDefault?: number;
    timePeriodAccountId?: number | null;
  },
  conn: Tx = db,
): Promise<void> {
  await conn.insert(openingBalanceHistories).values({
    accountId: data.accountId,
    amount: data.amount,
    date: toDateString(data.date) ?? today(),
    accType: data.accType,
    isDefault: data.isDefault ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * `createForUser()` - writes the asset leg and/or the liability leg for a new
 * contact's opening balance.
 */
export async function createOpeningBalanceForContact(
  data: {
    assetAccountId?: number | null;
    assetAmount?: number | null;
    liabilityAccountId?: number | null;
    liabilityAmount?: number | null;
    date: string;
  },
  conn: Tx = db,
): Promise<void> {
  if (data.assetAccountId) {
    await createOpeningBalance(
      {
        accountId: data.assetAccountId,
        amount: Number(data.assetAmount ?? 0),
        date: data.date,
        accType: AccTypeAsset,
      },
      conn,
    );
  }
  if (data.liabilityAccountId) {
    await createOpeningBalance(
      {
        accountId: data.liabilityAccountId,
        amount: Number(data.liabilityAmount ?? 0),
        date: data.date,
        accType: AccTypeLiability,
      },
      conn,
    );
  }
}

/** `createForHistory()` - the `type_opening_balances` audit row. */
export async function createOpeningBalanceHistory(
  data: { accountId: number; type: string; amount: number },
  conn: Tx = db,
): Promise<void> {
  await conn.insert(typeOpeningBalances).values({
    accountId: data.accountId,
    type: data.type,
    amount: data.amount,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** `assetAccountsAll()` / `liabilityAccountsAll()` */
export async function assetAccounts() {
  return db
    .select()
    .from(chartAccounts)
    .where(eq(chartAccounts.type, String(AccountType.Asset)))
    .orderBy(desc(chartAccounts.id));
}

export async function liabilityAccounts() {
  return db
    .select()
    .from(chartAccounts)
    .where(eq(chartAccounts.type, String(AccountType.Liability)))
    .orderBy(desc(chartAccounts.id));
}

/**
 * `OpeningBalanceHistory($timePeriod)`.
 *
 * The PHP repository wrote and read a `time_period_account_id` column on
 * `opening_balance_histories`, but that column does not exist in the shipped
 * schema - the inserts would have failed. The rows are matched by the period's
 * own date window instead, which is the relationship the data actually carries.
 */
export async function openingBalancesForPeriod(timePeriodId: number) {
  const period = await findPeriod(timePeriodId);
  return db
    .select({
      history: openingBalanceHistories,
      accountName: chartAccounts.name,
      accountCode: chartAccounts.code,
    })
    .from(openingBalanceHistories)
    .leftJoin(chartAccounts, eq(chartAccounts.id, openingBalanceHistories.accountId))
    .where(periodDateFilter(period))
    .orderBy(desc(openingBalanceHistories.id));
}

/** `closeStatement($id)` - closes an accounting period. */
export async function closeAccountingPeriod(id: number): Promise<void> {
  await db
    .update(timePeriodAccounts)
    .set({ endDate: today(), isClosed: 1, updatedAt: new Date() })
    .where(eq(timePeriodAccounts.id, id));
}

/** `closedBalanceList($is_default, $date)` */
export async function defaultOpeningBalances(date: string) {
  return db
    .select()
    .from(openingBalanceHistories)
    .where(
      and(
        eq(openingBalanceHistories.isDefault, 1),
        sql`date(${openingBalanceHistories.date}) = ${date}`,
      ),
    )
    .orderBy(desc(openingBalanceHistories.id));
}

type Period = { startDate: string | null; endDate: string | null } | null;

async function findPeriod(id: number): Promise<Period> {
  const [row] = await db
    .select({ startDate: timePeriodAccounts.startDate, endDate: timePeriodAccounts.endDate })
    .from(timePeriodAccounts)
    .where(eq(timePeriodAccounts.id, id))
    .limit(1);
  return row ?? null;
}

/** The date window a period covers, used in place of the missing foreign key. */
function periodDateFilter(period: Period) {
  if (!period?.startDate) return sql`1 = 1`;
  return period.endDate
    ? and(
        sql`${openingBalanceHistories.date} >= ${period.startDate}`,
        sql`${openingBalanceHistories.date} <= ${period.endDate}`,
      )!
    : sql`${openingBalanceHistories.date} >= ${period.startDate}`;
}

/** `OpeningBalanceHistoryRepository::all()` - the accounting periods list. */
export async function accountingPeriods() {
  return db.select().from(timePeriodAccounts).orderBy(desc(timePeriodAccounts.id));
}

/** `OpeningBalanceHistory::where('account_id', ...)->first()` - the duplicate guard. */
export async function openingBalanceExists(accountId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: openingBalanceHistories.id })
    .from(openingBalanceHistories)
    .where(eq(openingBalanceHistories.accountId, accountId))
    .limit(1);
  return Boolean(row);
}

/**
 * `OpeningBalanceHistoryRepository::update($data, $id)` - replaces every row of
 * one period with the posted asset and liability lines.
 */
export async function replaceOpeningBalances(
  timePeriodId: number,
  data: {
    date: string;
    assetAccountId: number[];
    assetAmount: number[];
    liabilityAccountId: number[];
    liabilityAmount: number[];
  },
): Promise<void> {
  const date = toDateString(data.date) ?? today();
  const period = await findPeriod(timePeriodId);

  await db.delete(openingBalanceHistories).where(periodDateFilter(period));

  for (let i = 0; i < data.assetAccountId.length; i++) {
    await db.insert(openingBalanceHistories).values({
      accountId: data.assetAccountId[i],
      amount: data.assetAmount[i] ?? 0,
      date,
      accType: AccTypeAsset,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  for (let i = 0; i < data.liabilityAccountId.length; i++) {
    await db.insert(openingBalanceHistories).values({
      accountId: data.liabilityAccountId[i],
      amount: data.liabilityAmount[i] ?? 0,
      date,
      accType: AccTypeLiability,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
