// ---------------------------------------------------------------------------
// Cashbook - port of Modules/Account's CashbookRepository.
//
// Everything hangs off the branch's own chart account: a voucher that debits it
// brought money in, one that credits it paid money out. The rows listed are the
// *other* legs of those vouchers, which is what the Blade rendered as the
// receipt/payment narration.
//
// `whereHasMorph('voucherable', '*')` in the PHP matched any morph target, but
// only `Voucher` carries `is_approve`, `date` and a `transactions` relation, so
// the join below is against `vouchers`.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { chartAccounts, transactions, vouchers } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { openAccountingPeriod } from '@/lib/accounting/periods';

/** The branch's own account - `ChartAccount::where('contactable_id', showroom)`. */
export async function showroomAccountId(showroomId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.contactableId, showroomId),
        eq(chartAccounts.contactableType, MorphType.ShowRoom),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

const rowSelect = {
  transaction: transactions,
  voucherDate: vouchers.date,
  voucherTxId: vouchers.txId,
  voucherNarration: vouchers.narration,
  accountName: chartAccounts.name,
  accountCode: chartAccounts.code,
};

/** `EXISTS (... the branch account on the given side ...)` */
function hasBranchLeg(accountId: number, side: 'Dr' | 'Cr' | null) {
  return side
    ? sql`exists (
        select 1 from transactions t2
        where t2.voucherable_id = ${vouchers.id}
          and t2.voucherable_type = ${MorphType.Voucher}
          and t2.account_id = ${accountId}
          and t2.type = ${side}
      )`
    : sql`exists (
        select 1 from transactions t2
        where t2.voucherable_id = ${vouchers.id}
          and t2.voucherable_type = ${MorphType.Voucher}
          and t2.account_id = ${accountId}
      )`;
}

/** `CashbookRepository::search_credit($date)` - money received on that day. */
export async function cashbookCredits(accountId: number, date: string) {
  return db
    .select(rowSelect)
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
        eq(vouchers.isApprove, 1),
        eq(vouchers.date, date),
        ne(transactions.accountId, accountId),
        hasBranchLeg(accountId, 'Dr'),
      ),
    )
    .orderBy(desc(transactions.createdAt));
}

/** `CashbookRepository::search_debit($date)` - money paid out on that day. */
export async function cashbookDebits(accountId: number, date: string) {
  return db
    .select(rowSelect)
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
        eq(vouchers.isApprove, 1),
        eq(vouchers.date, date),
        ne(transactions.accountId, accountId),
        hasBranchLeg(accountId, 'Cr'),
      ),
    )
    .orderBy(desc(transactions.createdAt));
}

/**
 * `CashbookRepository::search($previous_date)` - everything from the open
 * period's start up to the end of the previous day, which the Blade summed into
 * the opening balance.
 */
export async function cashbookOpening(accountId: number, previousDate: string) {
  const period = await openAccountingPeriod();
  const startDate = period?.startDate ?? previousDate;

  return db
    .select(rowSelect)
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
        eq(vouchers.isApprove, 1),
        gte(vouchers.createdAt, new Date(`${startDate}T00:00:00`)),
        lte(vouchers.createdAt, new Date(`${previousDate}T23:59:59`)),
        ne(transactions.accountId, accountId),
        hasBranchLeg(accountId, null),
      ),
    )
    .orderBy(desc(transactions.createdAt));
}
