import 'server-only';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db, transaction } from '@/lib/db/client';
import { chartAccounts, incomes, transactions, tranactionAccount, vouchers } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';

export type IncomeInput = { accountId: number; accountType: 'debit' | 'credit'; amount: number; date: string; narration?: string | null; note?: string | null; isApprove: number; showroomId?: number | null; createdBy: number };

export function incomePosting(data: IncomeInput) {
  // IncomeRepository::trranactionEntry creates exactly one account posting.
  return { accountId: data.accountId, type: data.accountType === 'debit' ? 'Dr' : 'Cr', amount: data.amount, narration: data.note ?? null };
}
export async function incomeAccounts() {
  return db.select().from(chartAccounts).where(or(eq(chartAccounts.type, '4'), eq(chartAccounts.parentId, 3))).orderBy(chartAccounts.code);
}
export async function createIncome(data: IncomeInput) { return saveIncome(null, data); }
export async function updateIncome(id: number, data: IncomeInput) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Income not found');
  return saveIncome(id, data);
}

async function saveIncome(id: number | null, data: IncomeInput) {
  return transaction(async (tx) => {
    let voucherId: number;
    const values = { amount: data.amount, date: data.date, narration: data.narration ?? null, voucherType: 'INC', paymentType: 'cash_voucher', accountId: data.accountId, updatedAt: new Date() };
    if (id !== null) {
      const [income] = await tx.select().from(incomes).where(eq(incomes.id, id)).limit(1);
      if (!income?.voucherId) throw new Error('Income not found');
      voucherId = income.voucherId;
      await tx.update(vouchers).set(values).where(eq(vouchers.id, voucherId));
      const previous = await tx.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.voucherableId, voucherId), eq(transactions.voucherableType, MorphType.Voucher)));
      const ids = previous.map((row) => row.id);
      if (ids.length) {
        await tx.delete(tranactionAccount).where(inArray(tranactionAccount.tranactionId, ids));
        await tx.delete(transactions).where(inArray(transactions.id, ids));
      }
    } else {
      const [created] = await tx.insert(vouchers).values({ ...values, accountType: 4, isApprove: data.isApprove, createdBy: data.createdBy, createdAt: new Date() });
      voucherId = Number(created.insertId);
      const [income] = await tx.insert(incomes).values({ accountId: data.accountId, showroomId: data.showroomId ?? null, voucherId, status: 1, createdBy: data.createdBy, createdAt: new Date(), updatedAt: new Date() });
      await tx.update(vouchers).set({ referableId: Number(income.insertId), referableType: 'Modules\\Account\\Entities\\Income' }).where(eq(vouchers.id, voucherId));
    }
    const [posting] = await tx.insert(transactions).values({ ...incomePosting(data), voucherableType: MorphType.Voucher, voucherableId: voucherId, createdAt: new Date(), updatedAt: new Date() });
    await tx.insert(tranactionAccount).values({ accountId: data.accountId, tranactionId: Number(posting.insertId), createdAt: new Date(), updatedAt: new Date() });
    await tx.update(vouchers).set({ txId: `INC-${voucherId}` }).where(eq(vouchers.id, voucherId));
    return voucherId;
  });
}
