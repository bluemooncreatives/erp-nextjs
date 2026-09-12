// ---------------------------------------------------------------------------
// Expenses, income and bank accounts.
//
// Ports Modules/Inventory/Repositories/ExpenseRepository.php,
// Modules/Account IncomeController and BankAccountController.
//
// An expense (and an income) is a voucher plus a marker row. The marker row
// (`expenses` / `incomes`) links the voucher to the branch that raised it, and
// is what the dashboard's expense total joins against.
//
// Note the leg ordering: ExpenseRepository builds its legs with `array_push`,
// so the SUB legs come FIRST and the main leg last - the opposite of
// JournalRepository, which unshifts. That difference is preserved.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import {
  bankAccounts,
  chartAccounts,
  documents,
  expenses,
  incomes,
  showRooms,
  tranactionAccount,
  transactions,
  vouchers,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { AccountType, ConfigurationGroup } from './accounts';
import { VoucherType, type TransactionLeg, type VoucherTypeCode } from './vouchers';
import { today, toDateString } from '@/lib/php-date';

type Tx = MySql2Database<typeof schema>;

export type ExpenseInput = {
  voucherType: VoucherTypeCode;
  amount: number;
  date: string;
  narration?: string | null;
  paymentType: string;
  isApprove: number;

  /** 'debit' - main account Dr, subs Cr; 'credit' - the reverse. */
  accountType: 'debit' | 'credit';
  /** The account being paid FROM (cash/bank) or the income account. */
  accountId: number;
  mainAmount: number;

  subAccountId: number[];
  subAmount: number[];
  subNarration: Array<string | null>;

  /** Bank voucher cheque details. */
  bankName?: string | null;
  bankBranch?: string | null;
  chequeNo?: string | null;
  chequeDate?: string | null;

  showroomId?: number | null;
  createdBy?: number | null;
};

/** `ExpenseRepository::trranactionEntry()` - sub legs first, main leg last. */
function buildLegs(data: ExpenseInput): TransactionLeg[] {
  const mainType: 'Dr' | 'Cr' = data.accountType === 'debit' ? 'Dr' : 'Cr';
  const subType: 'Dr' | 'Cr' = data.accountType === 'debit' ? 'Cr' : 'Dr';

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

async function writeVoucherWithLegs(
  conn: Tx,
  data: ExpenseInput,
): Promise<number> {
  const legs = buildLegs(data);

  const [inserted] = await conn.insert(vouchers).values({
    amount: data.amount,
    date: toDateString(data.date) ?? today(),
    narration: data.narration ?? null,
    voucherType: data.voucherType,
    paymentType: data.paymentType,
    isApprove: data.isApprove,
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
    .set({ txId: `${data.voucherType}-${voucherId}` })
    .where(eq(vouchers.id, voucherId));

  return voucherId;
}

/** `ExpenseRepository::create($data)` */
export async function createExpense(data: ExpenseInput): Promise<number> {
  return runInTransaction(async (tx) => {
    const voucherId = await writeVoucherWithLegs(tx, data);

    await tx.insert(expenses).values({
      showroomId: data.showroomId ?? null,
      voucherId,
      status: 0,
      createdBy: data.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return voucherId;
  });
}

export { createIncome, updateIncome, incomeAccounts as incomeAccountList } from './income';

async function replaceLegs(conn: Tx, voucherId: number, data: ExpenseInput) {
  const existing = await conn
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.voucherableId, voucherId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    );

  const ids = existing.map((e) => e.id);
  if (ids.length) {
    await conn.delete(tranactionAccount).where(inArray(tranactionAccount.tranactionId, ids));
    await conn.delete(transactions).where(inArray(transactions.id, ids));
  }

  for (const leg of buildLegs(data)) {
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

/** `ExpenseRepository::update($data, $id)` - `$id` is the EXPENSE id. */
export async function updateExpense(
  expenseId: number,
  data: ExpenseInput,
): Promise<void> {
  const [expense] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);
  if (!expense?.voucherId) throw new Error('Expense not found');

  await runInTransaction(async (tx) => {
    await tx
      .update(vouchers)
      .set({
        amount: data.amount,
        date: toDateString(data.date) ?? today(),
        narration: data.narration ?? null,
        voucherType: data.voucherType,
        paymentType: data.paymentType,
        updatedBy: data.createdBy ?? null,
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, expense.voucherId!));

    await replaceLegs(tx, expense.voucherId!, data);

    await tx
      .update(vouchers)
      .set({ txId: `${data.voucherType}-${expense.voucherId}` })
      .where(eq(vouchers.id, expense.voucherId!));
  });
}

/** `ExpenseRepository::delete($id)` - removes the voucher and its legs. */
export async function deleteExpense(expenseId: number): Promise<void> {
  const [expense] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);
  if (!expense) return;

  await runInTransaction(async (tx) => {
    if (expense.voucherId) {
      const legs = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.voucherableId, expense.voucherId),
            eq(transactions.voucherableType, MorphType.Voucher),
          ),
        );
      const ids = legs.map((l) => l.id);
      if (ids.length) {
        await tx
          .delete(tranactionAccount)
          .where(inArray(tranactionAccount.tranactionId, ids));
        await tx.delete(transactions).where(inArray(transactions.id, ids));
      }
      await tx.delete(documents).where(eq(documents.voucherId, expense.voucherId));
      await tx.delete(vouchers).where(eq(vouchers.id, expense.voucherId));
    }
    await tx.delete(expenses).where(eq(expenses.id, expenseId));
  });
}

export async function deleteIncome(incomeId: number): Promise<void> {
  const [income] = await db
    .select()
    .from(incomes)
    .where(eq(incomes.id, incomeId))
    .limit(1);
  if (!income) return;

  await runInTransaction(async (tx) => {
    if (income.voucherId) {
      const legs = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.voucherableId, income.voucherId),
            eq(transactions.voucherableType, MorphType.Voucher),
          ),
        );
      const ids = legs.map((l) => l.id);
      if (ids.length) {
        await tx
          .delete(tranactionAccount)
          .where(inArray(tranactionAccount.tranactionId, ids));
        await tx.delete(transactions).where(inArray(transactions.id, ids));
      }
      await tx.delete(documents).where(eq(documents.voucherId, income.voucherId));
      await tx.delete(vouchers).where(eq(vouchers.id, income.voucherId));
    }
    await tx.delete(incomes).where(eq(incomes.id, incomeId));
  });
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** `expenceList()` - branch-scoped unless the user may see them all. */
export async function listExpenses(filters: {
  showroomId?: number | null;
  allBranches?: boolean;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const condition =
    filters.allBranches || filters.showroomId == null
      ? undefined
      : eq(expenses.showroomId, filters.showroomId);

  const rows = await db
    .select({
      expense: expenses,
      voucher: vouchers,
      showroomName: showRooms.name,
    })
    .from(expenses)
    .leftJoin(vouchers, eq(vouchers.id, expenses.voucherId))
    .leftJoin(showRooms, eq(showRooms.id, expenses.showroomId))
    .where(condition)
    .orderBy(desc(expenses.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(expenses)
    .where(condition);

  return { rows, total: Number(countRow?.count ?? 0), page, perPage };
}

export async function listIncomes(filters: {
  showroomId?: number | null;
  allBranches?: boolean;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const condition =
    filters.allBranches || filters.showroomId == null
      ? undefined
      : eq(incomes.showroomId, filters.showroomId);

  const rows = await db
    .select({
      income: incomes,
      voucher: vouchers,
      showroomName: showRooms.name,
      accountName: chartAccounts.name,
    })
    .from(incomes)
    .leftJoin(vouchers, eq(vouchers.id, incomes.voucherId))
    .leftJoin(showRooms, eq(showRooms.id, incomes.showroomId))
    .leftJoin(chartAccounts, eq(chartAccounts.id, incomes.accountId))
    .where(condition)
    .orderBy(desc(incomes.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(incomes)
    .where(condition);

  return { rows, total: Number(countRow?.count ?? 0), page, perPage };
}

/** `expenceAccount()` - every expense-type account (type 3). */
export async function expenseAccounts() {
  return db
    .select()
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.type, String(AccountType.Expense)),
        eq(chartAccounts.isGroup, 0),
      ),
    )
    .orderBy(chartAccounts.code);
}

// ---------------------------------------------------------------------------
// Bank accounts
// ---------------------------------------------------------------------------

export async function listBankAccounts() {
  return db
    .select({
      account: bankAccounts,
      chartAccountName: chartAccounts.name,
      chartAccountCode: chartAccounts.code,
    })
    .from(bankAccounts)
    .leftJoin(chartAccounts, eq(chartAccounts.id, bankAccounts.chartAccountId))
    .orderBy(desc(bankAccounts.id));
}

export async function findBankAccount(id: number) {
  const [row] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * `BankAccountController@store` - a bank account owns a ChartAccount under the
 * Bank root, in the Bank configuration group.
 */
export async function createBankAccount(
  data: {
    bankName: string;
    branchName?: string | null;
    accountName?: string | null;
    accountNo?: string | null;
    description?: string | null;
  },
  userId?: number | null,
): Promise<number> {
  const { RootAccountId } = await import('./accounts');

  return runInTransaction(async (tx) => {
    const [accountRow] = await tx.insert(chartAccounts).values({
      level: 2,
      isGroup: 0,
      name: data.bankName,
      type: String(AccountType.Asset),
      configurationGroupId: ConfigurationGroup.Bank,
      status: 1,
      parentId: RootAccountId.Bank,
      description: data.description ?? null,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const chartAccountId = Number(accountRow.insertId);
    // `$chart_account->update(['code' => '03-'.$chart_account->id])` - the bank
    // account code is the parent id and the account id, with no type prefix.
    await tx
      .update(chartAccounts)
      .set({
        code: `${String(RootAccountId.Bank).padStart(2, '0')}-${chartAccountId}`,
      })
      .where(eq(chartAccounts.id, chartAccountId));

    const [inserted] = await tx.insert(bankAccounts).values({
      bankName: data.bankName,
      chartAccountId,
      branchName: data.branchName ?? null,
      accountName: data.accountName ?? null,
      accountNo: data.accountNo ?? null,
      description: data.description ?? null,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Number(inserted.insertId);
  });
}

export async function updateBankAccount(
  id: number,
  data: {
    bankName: string;
    branchName?: string | null;
    accountName?: string | null;
    accountNo?: string | null;
    description?: string | null;
  },
  userId?: number | null,
): Promise<void> {
  const existing = await findBankAccount(id);
  if (!existing) return;

  await runInTransaction(async (tx) => {
    await tx
      .update(bankAccounts)
      .set({
        bankName: data.bankName,
        branchName: data.branchName ?? null,
        accountName: data.accountName ?? null,
        accountNo: data.accountNo ?? null,
        description: data.description ?? null,
        updatedBy: userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, id));

    await tx
      .update(chartAccounts)
      .set({ name: data.bankName, updatedBy: userId ?? null, updatedAt: new Date() })
      .where(eq(chartAccounts.id, existing.chartAccountId));
  });
}

export async function deleteBankAccount(id: number): Promise<void> {
  const existing = await findBankAccount(id);
  if (!existing) return;

  await runInTransaction(async (tx) => {
    await tx.delete(bankAccounts).where(eq(bankAccounts.id, id));
    await tx.delete(chartAccounts).where(eq(chartAccounts.id, existing.chartAccountId));
  });
}
