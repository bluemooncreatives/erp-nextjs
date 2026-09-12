// ---------------------------------------------------------------------------
// Money transfer between showrooms - port of Modules/Account's
// TransferController and TransferRepository.
//
// The repository is a near-copy of the contra/journal one, with two differences
// worth keeping: its `trranactionEntry()` uses `array_push`, so the sub legs come
// first and the main leg last (JournalRepository used `array_unshift`), and the
// voucher is always written with `is_transfer = 1`.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  chartAccounts,
  documents,
  tranactionAccount,
  transactions,
  vouchers,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { AccountType } from '@/lib/accounting/accounts';
import { VoucherType, type TransactionLeg } from '@/lib/accounting/vouchers';

type Tx = Parameters<Parameters<typeof runInTransaction>[0]>[0];

export type TransferInput = {
  amount: number;
  date: string;
  /** 'debit' - the main account is debited; 'credit' - it is credited. */
  accountType: 'debit' | 'credit';
  accountId: number;
  mainAmount: number;
  narration?: string | null;

  subAccountId: number[];
  subAmount: number[];
  subNarration: Array<string | null>;

  isApprove: number;
  chequeNo?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  createdBy?: number | null;
};

/** `TransferRepository::trranactionEntry($data)` - sub legs first, main last. */
export function buildTransferLegs(data: TransferInput): TransactionLeg[] {
  const subType: 'Dr' | 'Cr' = data.accountType === 'debit' ? 'Cr' : 'Dr';
  const mainType: 'Dr' | 'Cr' = data.accountType === 'debit' ? 'Dr' : 'Cr';

  const legs: TransactionLeg[] = [];
  for (let i = 0; i < data.subAccountId.length; i++) {
    legs.push({
      accountId: data.subAccountId[i],
      type: subType,
      amount: data.subAmount[i] ?? 0,
      narration: data.subNarration[i] ?? null,
    });
  }
  legs.push({
    accountId: data.accountId,
    type: mainType,
    amount: data.mainAmount,
  });

  return legs;
}

async function writeDocument(
  conn: Tx,
  voucherId: number,
  data: TransferInput,
): Promise<void> {
  if (!data.chequeNo || !data.bankName) return;

  const [existing] = await conn
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.voucherId, voucherId))
    .limit(1);

  const values = {
    voucherId,
    bankBranch: data.bankBranch ?? null,
    bankName: data.bankName ?? null,
    chequeDate: data.chequeDate ?? null,
    chequeNo: data.chequeNo ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await conn.update(documents).set(values).where(eq(documents.id, existing.id));
  } else {
    await conn.insert(documents).values({ ...values, createdAt: new Date() });
  }
}

async function writeLegs(
  conn: Tx,
  voucherId: number,
  data: TransferInput,
): Promise<void> {
  for (const leg of buildTransferLegs(data)) {
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

    // `fromAccounts()->attach()` - Cr legs point at the sub accounts, Dr at main.
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
}

/** `TransferRepository::create($data)` */
export async function createTransferVoucher(data: TransferInput): Promise<number> {
  return runInTransaction(async (conn) => {
    const [inserted] = await conn.insert(vouchers).values({
      amount: data.amount,
      date: data.date,
      narration: data.narration ?? null,
      voucherType: VoucherType.Contra,
      paymentType: 'contra_voucher',
      isApprove: data.isApprove,
      isTransfer: 1,
      createdBy: data.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const voucherId = Number(inserted.insertId);

    await writeDocument(conn, voucherId, data);
    await writeLegs(conn, voucherId, data);

    await conn
      .update(vouchers)
      .set({ txId: `${VoucherType.Contra}-${voucherId}` })
      .where(eq(vouchers.id, voucherId));

    return voucherId;
  });
}

/** `TransferRepository::update($data, $id)` */
export async function updateTransferVoucher(
  id: number,
  data: TransferInput,
): Promise<number> {
  return runInTransaction(async (conn) => {
    await conn
      .update(vouchers)
      .set({
        amount: data.amount,
        date: data.date,
        narration: data.narration ?? null,
        voucherType: VoucherType.Contra,
        paymentType: 'contra_voucher',
        isApprove: data.isApprove,
        isTransfer: 1,
        updatedBy: data.createdBy ?? null,
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, id));

    await writeDocument(conn, id, data);

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

    await writeLegs(conn, id, data);

    await conn
      .update(vouchers)
      .set({ txId: `${VoucherType.Contra}-${id}` })
      .where(eq(vouchers.id, id));

    return id;
  });
}

/** `TransferRepository::indexList()` */
export async function transferVouchers() {
  return db
    .select()
    .from(vouchers)
    .where(eq(vouchers.isTransfer, 1))
    .orderBy(desc(vouchers.createdAt));
}

export async function findTransferVoucher(id: number) {
  const [row] = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
  if (!row) return null;

  const legs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.voucherableId, id),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    );

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.voucherId, id))
    .limit(1);

  return { voucher: row, legs, document: document ?? null };
}

/** `TransferRepository::allShowroomAccounts()` */
export async function showroomAccounts() {
  return db
    .select()
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.contactableType, MorphType.ShowRoom),
        eq(chartAccounts.type, String(AccountType.Asset)),
      ),
    );
}
