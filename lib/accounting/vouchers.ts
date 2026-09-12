// ---------------------------------------------------------------------------
// Vouchers and double-entry posting.
// Port of Modules/Account/Repositories/VoucherRepository.php.
//
// A voucher is the accounting document; its `transactions` are the Dr/Cr legs.
// `tranaction_account` records, for each leg, the accounts on the OTHER side -
// the PHP code attached them through `$transaction->fromAccounts()`.
//
// Voucher types (vouchers.voucher_type):
//   CV  Cash Voucher    BV  Bank Voucher
//   JV  Journal Voucher CRV Contra Voucher
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  documents,
  tranactionAccount,
  transactions,
  vouchers,
} from '@/lib/db/schema';
import * as schema from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';

type Tx = MySql2Database<typeof schema>;

export const VoucherType = {
  Cash: 'CV',
  Bank: 'BV',
  Journal: 'JV',
  Contra: 'CRV',
} as const;

export type VoucherTypeCode = (typeof VoucherType)[keyof typeof VoucherType];

/** `getVoucherTypeIdAttribute()` from the Voucher model. */
export function voucherTypeId(code: string | null): number {
  switch (code) {
    case 'CV': return 1;
    case 'BV': return 2;
    case 'JV': return 3;
    case 'CRV': return 4;
    default: return 0;
  }
}

export const VoucherApprovalStatus = {
  Pending: 0,
  Approved: 1,
  Cancelled: 2,
} as const;

/** One Dr or Cr leg. */
export type TransactionLeg = {
  accountId: number;
  type: 'Dr' | 'Cr';
  amount: number;
  narration?: string | null;
};

/**
 * Input to `create()`. Mirrors the `$data` array the PHP repository received.
 *
 * `debitAccountId` / `creditAccountId` accept either a single id (a simple
 * two-leg voucher) or an array (a compound voucher, one leg per entry) - the
 * exact shape `trranactionEntry()` branched on.
 */
export type VoucherInput = {
  amount: number;
  date: string;
  narration?: string | null;
  voucherType: VoucherTypeCode;
  paymentType?: string | null;
  isApprove: number;

  debitAccountId: number | number[];
  creditAccountId: number | number[];
  /** Required when the matching account id is an array. */
  debitAccountAmount?: number | number[];
  creditAccountAmount?: number | number[];
  debitAccountNarration?: Array<string | null>;
  creditAccountNarration?: Array<string | null>;

  /** Bank voucher cheque details - written to `documents`. */
  bankName?: string | null;
  bankBranch?: string | null;
  chequeNo?: string | null;
  chequeDate?: string | null;

  /** Links the voucher back to the document that produced it. */
  referableId?: number | null;
  referableType?: string | null;

  accountType?: number | null;
  accountId?: number | null;
  isTransfer?: number;
  createdBy?: number | null;
};

/**
 * `trranactionEntry($data)` - expand the input into Dr/Cr legs.
 *
 * Note the PHP original's shape: in the compound branches every element of the
 * array side is posted as 'Dr' and the single side as 'Cr', regardless of which
 * key held the array. That asymmetry is reproduced here so the resulting
 * transaction rows are identical.
 */
export function buildTransactionLegs(data: VoucherInput): TransactionLeg[] {
  const legs: TransactionLeg[] = [];

  if (Array.isArray(data.debitAccountId)) {
    const amounts = toArray(data.debitAccountAmount, data.debitAccountId.length);
    for (let i = 0; i < data.debitAccountId.length; i++) {
      legs.push({
        accountId: data.debitAccountId[i],
        type: 'Dr',
        amount: amounts[i] ?? 0,
        narration: data.debitAccountNarration?.[i] ?? null,
      });
    }
    legs.push({
      accountId: single(data.creditAccountId),
      type: 'Cr',
      amount: single(data.creditAccountAmount) ?? 0,
    });
    return legs;
  }

  if (Array.isArray(data.creditAccountId)) {
    const amounts = toArray(data.creditAccountAmount, data.creditAccountId.length);
    for (let i = 0; i < data.creditAccountId.length; i++) {
      legs.push({
        accountId: data.creditAccountId[i],
        type: 'Dr',
        amount: amounts[i] ?? 0,
        narration: data.creditAccountNarration?.[i] ?? null,
      });
    }
    legs.push({
      accountId: single(data.debitAccountId),
      type: 'Cr',
      amount: single(data.debitAccountAmount) ?? 0,
    });
    return legs;
  }

  // The simple case: one debit, one credit, both for the voucher amount.
  return [
    { accountId: data.debitAccountId, type: 'Dr', amount: data.amount },
    { accountId: data.creditAccountId, type: 'Cr', amount: data.amount },
  ];
}

function toArray(value: number | number[] | undefined, length: number): number[] {
  if (Array.isArray(value)) return value;
  return Array.from({ length }, () => value ?? 0);
}

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `VoucherRepository::create($data)`.
 * Runs in one transaction so a voucher never exists without its legs.
 */
export async function createVoucher(data: VoucherInput, tx?: Tx) {
  const run = async (conn: Tx) => {
    const legs = buildTransactionLegs(data);

    const [inserted] = await conn.insert(vouchers).values({
      amount: data.amount,
      date: data.date,
      narration: data.narration ?? null,
      voucherType: data.voucherType,
      paymentType: data.paymentType ?? null,
      isApprove: data.isApprove,
      isTransfer: data.isTransfer ?? 0,
      accountType: data.accountType ?? null,
      accountId: data.accountId ?? null,
      referableId: data.referableId ?? null,
      referableType: data.referableType ?? null,
      createdBy: data.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const voucherId = Number(inserted.insertId);

    if (data.voucherType === VoucherType.Bank) {
      await conn.insert(documents).values({
        voucherId,
        bankBranch: data.bankBranch ?? null,
        bankName: data.bankName ?? null,
        chequeDate: data.chequeDate ?? null,
        chequeNo: data.chequeNo ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await insertLegs(conn, voucherId, legs, data);

    // `tx_id` is only known after the insert, so the PHP code patched it back.
    await conn
      .update(vouchers)
      .set({ txId: `${data.voucherType}-${voucherId}` })
      .where(eq(vouchers.id, voucherId));

    return voucherId;
  };

  return tx ? run(tx) : runInTransaction(run);
}

/**
 * Insert the Dr/Cr legs and their `tranaction_account` cross-links.
 * A 'Cr' leg links to the debit side and vice versa, per the PHP loop.
 */
async function insertLegs(
  conn: Tx,
  voucherId: number,
  legs: TransactionLeg[],
  data: VoucherInput,
) {
  const debitIds = asIdList(data.debitAccountId);
  const creditIds = asIdList(data.creditAccountId);

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

    const transactionId = Number(row.insertId);
    const counterparts = leg.type === 'Cr' ? debitIds : creditIds;

    if (counterparts.length) {
      await conn.insert(tranactionAccount).values(
        counterparts.map((accountId) => ({
          accountId,
          tranactionId: transactionId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }
  }
}

function asIdList(value: number | number[]): number[] {
  return Array.isArray(value) ? value : [value];
}

/** `VoucherRepository::update($data, $id)` - replaces all legs. */
export async function updateVoucher(id: number, data: VoucherInput, tx?: Tx) {
  const run = async (conn: Tx) => {
    const legs = buildTransactionLegs(data);

    await conn
      .update(vouchers)
      .set({
        amount: data.amount,
        date: data.date,
        narration: data.narration ?? null,
        voucherType: data.voucherType,
        isApprove: data.isApprove,
        updatedBy: data.createdBy ?? null,
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, id));

    if (data.voucherType === VoucherType.Bank) {
      const [existing] = await conn
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.voucherId, id))
        .limit(1);

      const values = {
        bankBranch: data.bankBranch ?? null,
        bankName: data.bankName ?? null,
        chequeDate: data.chequeDate ?? null,
        chequeNo: data.chequeNo ?? null,
        updatedAt: new Date(),
      };

      if (existing) {
        await conn.update(documents).set(values).where(eq(documents.id, existing.id));
      } else {
        await conn
          .insert(documents)
          .values({ voucherId: id, ...values, createdAt: new Date() });
      }
    } else if (data.voucherType === VoucherType.Cash) {
      // The PHP code dropped the cheque document when switching to cash.
      await conn.delete(documents).where(eq(documents.voucherId, id));
    }

    await deleteLegs(conn, id);
    await insertLegs(conn, id, legs, data);

    await conn
      .update(vouchers)
      .set({ txId: `${data.voucherType}-${id}` })
      .where(eq(vouchers.id, id));

    return id;
  };

  return tx ? run(tx) : runInTransaction(run);
}

async function deleteLegs(conn: Tx, voucherId: number) {
  const legs = await conn
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.voucherableId, voucherId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    );

  const ids = legs.map((l) => l.id);
  if (ids.length) {
    await conn.delete(tranactionAccount).where(inArray(tranactionAccount.tranactionId, ids));
    await conn.delete(transactions).where(inArray(transactions.id, ids));
  }
}

/** `VoucherRepository::delete($id)` - detaches links, removes legs, then the voucher. */
export async function deleteVoucher(id: number, tx?: Tx) {
  const run = async (conn: Tx) => {
    await deleteLegs(conn, id);
    await conn.delete(documents).where(eq(documents.voucherId, id));
    await conn.delete(vouchers).where(eq(vouchers.id, id));
  };
  return tx ? run(tx) : runInTransaction(run);
}

export async function findVoucher(id: number) {
  const [row] = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
  return row ?? null;
}

export async function voucherTransactions(voucherId: number) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.voucherableId, voucherId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .orderBy(transactions.id);
}

/** `status_approval(['id' => .., 'status' => ..])` */
export async function setVoucherApproval(id: number, status: number, userId?: number) {
  await db
    .update(vouchers)
    .set({ isApprove: status, updatedBy: userId ?? null, updatedAt: new Date() })
    .where(eq(vouchers.id, id));
}

/** `allApproved()` - bulk-approve every pending voucher. */
export async function approveAllVouchers() {
  await db
    .update(vouchers)
    .set({ isApprove: VoucherApprovalStatus.Approved, updatedAt: new Date() })
    .where(eq(vouchers.isApprove, VoucherApprovalStatus.Pending));
}

export async function vouchersByPaymentType(paymentType: string) {
  return db
    .select()
    .from(vouchers)
    .where(eq(vouchers.paymentType, paymentType))
    .orderBy(desc(vouchers.id));
}

/** Vouchers raised against a given document (a sale, purchase order, ...). */
export async function vouchersFor(referableType: string, referableId: number) {
  return db
    .select()
    .from(vouchers)
    .where(
      and(
        eq(vouchers.referableType, referableType),
        eq(vouchers.referableId, referableId),
      ),
    )
    .orderBy(desc(vouchers.id));
}
