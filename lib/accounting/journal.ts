// ---------------------------------------------------------------------------
// Journal vouchers - port of Modules/Account/Repositories/JournalRepository.php
//
// A journal voucher has ONE main account and MANY sub accounts:
//
//   account_type 'debit'  -> main account Dr,  each sub account Cr
//   account_type 'credit' -> main account Cr,  each sub account Dr
//
// The PHP built the leg list with `array_unshift`, so the main leg ends up
// FIRST and the sub legs appear in reverse order. That ordering is preserved -
// the statement and ledger screens render legs in stored order.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import { chartAccounts, tranactionAccount, transactions, vouchers } from '@/lib/db/schema';
import * as schema from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { VoucherType, type TransactionLeg, type VoucherTypeCode } from './vouchers';

type Tx = MySql2Database<typeof schema>;

export type JournalInput = {
  voucherType?: VoucherTypeCode;
  amount: number;
  date: string;
  /** 'debit' - main account is debited; 'credit' - main account is credited. */
  accountType: 'debit' | 'credit';
  paymentType?: string;
  /** The single "main" account. */
  accountId: number;
  mainAmount: number;
  narration?: string | null;

  subAccountId: number[];
  subAmount: number[];
  subNarration: Array<string | null>;

  /** Links the voucher to the document that produced it. */
  referableId?: number | null;
  referableType?: string | null;

  isApprove: number;
  createdBy?: number | null;
};

/** `trranactionEntry($data)` from JournalRepository. */
export function buildJournalLegs(data: JournalInput): TransactionLeg[] {
  const mainType: 'Dr' | 'Cr' = data.accountType === 'debit' ? 'Dr' : 'Cr';
  const subType: 'Dr' | 'Cr' = data.accountType === 'debit' ? 'Cr' : 'Dr';

  // `array_unshift` in a loop reverses the sub legs...
  const legs: TransactionLeg[] = [];
  for (let i = 0; i < data.subAccountId.length; i++) {
    legs.unshift({
      accountId: data.subAccountId[i],
      type: subType,
      amount: data.subAmount[i] ?? 0,
      narration: data.subNarration[i] ?? null,
    });
  }
  // ...and the main leg is unshifted last, so it lands at the front.
  legs.unshift({
    accountId: data.accountId,
    type: mainType,
    amount: data.mainAmount,
  });

  return legs;
}

/** `JournalRepository::create($data)` */
export async function createJournalVoucher(data: JournalInput, tx?: Tx): Promise<number> {
  const run = async (conn: Tx) => {
    const legs = buildJournalLegs(data);
    const voucherType = data.voucherType ?? VoucherType.Journal;

    const [inserted] = await conn.insert(vouchers).values({
      amount: data.amount,
      date: data.date,
      narration: data.narration ?? null,
      voucherType,
      paymentType: data.paymentType ?? 'journal_voucher',
      isApprove: data.isApprove,
      referableId: data.referableId ?? null,
      referableType: data.referableType ?? null,
      createdBy: data.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const voucherId = Number(inserted.insertId);

    for (const leg of legs) {
      const [row] = await conn.insert(transactions).values({
        accountId: leg.accountId,
        type: leg.type,
        amount: leg.amount,
        narration: leg.narration ?? null,
        voucherableType: MorphType.Voucher,
        voucherableId: voucherId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Cr legs cross-link to the sub accounts, Dr legs to the main account.
      const counterparts =
        leg.type === 'Cr' ? data.subAccountId : [data.accountId];

      if (counterparts.length) {
        await conn.insert(tranactionAccount).values(
          counterparts.map((accountId) => ({
            accountId,
            tranactionId: Number(row.insertId),
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }
    }

    await conn
      .update(vouchers)
      .set({ txId: `${voucherType}-${voucherId}` })
      .where(eq(vouchers.id, voucherId));

    return voucherId;
  };

  return tx ? run(tx) : runInTransaction(run);
}

/** `JournalRepository::update($data, $id)` */
export async function updateJournalVoucher(id: number, data: JournalInput, tx?: Tx) {
  const run = async (conn: Tx) => {
    const legs = buildJournalLegs(data);
    const voucherType = data.voucherType ?? VoucherType.Journal;

    await conn
      .update(vouchers)
      .set({
        amount: data.amount,
        date: data.date,
        narration: data.narration ?? null,
        voucherType,
        paymentType: data.paymentType ?? 'journal_voucher',
        isApprove: data.isApprove,
        updatedBy: data.createdBy ?? null,
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, id));

    const existing = await conn
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.voucherableId, id),
          eq(transactions.voucherableType, MorphType.Voucher),
        ),
      );
    const ids = existing.map((e) => e.id);
    if (ids.length) {
      await conn.delete(tranactionAccount).where(inArray(tranactionAccount.tranactionId, ids));
      await conn.delete(transactions).where(inArray(transactions.id, ids));
    }

    for (const leg of legs) {
      const [row] = await conn.insert(transactions).values({
        accountId: leg.accountId,
        type: leg.type,
        amount: leg.amount,
        narration: leg.narration ?? null,
        voucherableType: MorphType.Voucher,
        voucherableId: id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const counterparts = leg.type === 'Cr' ? data.subAccountId : [data.accountId];
      if (counterparts.length) {
        await conn.insert(tranactionAccount).values(
          counterparts.map((accountId) => ({
            accountId,
            tranactionId: Number(row.insertId),
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }
    }

    await conn
      .update(vouchers)
      .set({ txId: `${voucherType}-${id}` })
      .where(eq(vouchers.id, id));

    return id;
  };

  return tx ? run(tx) : runInTransaction(run);
}

/** `journal_all()` */
export async function journalVouchers() {
  return db
    .select()
    .from(vouchers)
    .where(eq(vouchers.paymentType, 'journal_voucher'))
    .orderBy(vouchers.id);
}

/** `transactionalAccounts()` - postable (non-group), active accounts. */
export async function transactionalAccounts() {
  return db
    .select()
    .from(chartAccounts)
    .where(and(eq(chartAccounts.isGroup, 0), eq(chartAccounts.status, 1)))
    .orderBy(chartAccounts.code);
}

/** `all()` - every active account, group or not. */
export async function activeAccounts() {
  return db
    .select()
    .from(chartAccounts)
    .where(eq(chartAccounts.status, 1))
    .orderBy(chartAccounts.code);
}
