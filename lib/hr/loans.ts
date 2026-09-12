// ---------------------------------------------------------------------------
// Staff loans - port of Modules/Setup's ApplyLoanController and
// ApplyLoanRepository.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { applyLoans, departments, roles, staffs, users } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { findAccountByCode, findContactAccount } from '@/lib/accounting/accounts';
import { createVoucher, VoucherType } from '@/lib/accounting/vouchers';
import { VoucherApproval, voucherAutoApproved } from '@/lib/business-settings';
import { today, toDateString } from '@/lib/php-date';

export const LoanApproval = { Pending: 0, Approved: 1, Rejected: 2 } as const;

/** The Blade's three badges, keyed by `apply_loans.approval`. */
export function approvalBadge(approval: number) {
  if (approval === LoanApproval.Approved) return { label: 'Approved', color: 'success' } as const;
  if (approval === LoanApproval.Pending) return { label: 'Pending', color: 'warning' } as const;
  return { label: 'Cancelled', color: 'error' } as const;
}

/** The account the PHP credited when a loan was paid out. */
const ADVANCE_AND_LOAN_CODE = '01-01-02';

export type LoanInput = {
  userId: number;
  departmentId: number;
  title: string;
  loanType: string;
  loanDate: string;
  amount: number;
  totalMonth: number;
  monthlyInstallment: number;
  note?: string | null;
};

const loanSelect = {
  loan: applyLoans,
  userName: users.name,
  userEmail: users.email,
  departmentName: departments.name,
};

/** `ApplyLoanRepository::all()` - the signed-in user's own and created loans. */
export async function listMyLoans(userId: number) {
  return db
    .select(loanSelect)
    .from(applyLoans)
    .leftJoin(users, eq(users.id, applyLoans.userId))
    .leftJoin(departments, eq(departments.id, applyLoans.departmentId))
    .where(or(eq(applyLoans.userId, userId), eq(applyLoans.createdBy, userId)))
    .orderBy(desc(applyLoans.createdAt));
}

/** `ApplyLoanRepository::appliedAll()` - everything, for the approval screen. */
export async function listAllLoans() {
  return db
    .select(loanSelect)
    .from(applyLoans)
    .leftJoin(users, eq(users.id, applyLoans.userId))
    .leftJoin(departments, eq(departments.id, applyLoans.departmentId))
    .orderBy(desc(applyLoans.createdAt));
}

/** `ApplyLoanRepository::staffLoans($id)` */
export async function staffLoans(userId: number) {
  return db
    .select(loanSelect)
    .from(applyLoans)
    .leftJoin(users, eq(users.id, applyLoans.userId))
    .leftJoin(departments, eq(departments.id, applyLoans.departmentId))
    .where(eq(applyLoans.userId, userId))
    .orderBy(desc(applyLoans.createdAt));
}

export async function findLoan(id: number) {
  const [row] = await db
    .select(loanSelect)
    .from(applyLoans)
    .leftJoin(users, eq(users.id, applyLoans.userId))
    .leftJoin(departments, eq(departments.id, applyLoans.departmentId))
    .where(eq(applyLoans.id, id))
    .limit(1);
  return row ?? null;
}

/** `ApplyLoanRepository::create($data)` */
export async function createLoan(data: LoanInput, actorId: number): Promise<void> {
  await db.insert(applyLoans).values({
    userId: data.userId,
    departmentId: data.departmentId,
    title: data.title,
    loanType: data.loanType,
    applyDate: today(),
    loanDate: toDateString(data.loanDate) ?? today(),
    amount: data.amount,
    totalMonth: data.totalMonth,
    monthlyInstallment: data.monthlyInstallment,
    note: data.note ?? null,
    // The model's `saving` hook stamped the actor on every write.
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * `ApplyLoanRepository::update($data, $id)` - note the PHP reassigned
 * `user_id` to the editing user, which is reproduced here.
 */
export async function updateLoan(
  id: number,
  data: LoanInput,
  actorId: number,
): Promise<void> {
  await db
    .update(applyLoans)
    .set({
      userId: actorId,
      departmentId: data.departmentId,
      title: data.title,
      loanType: data.loanType,
      applyDate: today(),
      loanDate: toDateString(data.loanDate) ?? today(),
      amount: data.amount,
      totalMonth: data.totalMonth,
      monthlyInstallment: data.monthlyInstallment,
      note: data.note ?? null,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(applyLoans.id, id));
}

export async function deleteLoan(id: number): Promise<void> {
  await db.delete(applyLoans).where(eq(applyLoans.id, id));
}

/**
 * `ApplyLoanRepository::change_approval($data)`.
 *
 * Approving a loan posts a cash voucher: the staff member's own contact account
 * is debited and `01-01-02` (Advance & Loan Accounts) credited.
 */
export async function changeLoanApproval(
  id: number,
  approval: number,
  actorId: number,
): Promise<void> {
  const [loan] = await db.select().from(applyLoans).where(eq(applyLoans.id, id)).limit(1);
  if (!loan) return;

  if (approval === LoanApproval.Approved) {
    const creditAccount = await findAccountByCode(ADVANCE_AND_LOAN_CODE);
    const debitAccount = await findContactAccount(loan.userId, MorphType.User);

    if (creditAccount && debitAccount) {
      await createVoucher({
        voucherType: VoucherType.Cash,
        amount: loan.amount,
        date: today(),
        paymentType: 'voucher_payment',
        creditAccountId: creditAccount.id,
        creditAccountAmount: loan.amount,
        creditAccountNarration: ['Advance & Loan Accounts'],
        debitAccountId: [debitAccount.id],
        debitAccountAmount: [loan.amount],
        debitAccountNarration: ['Staff Loan'],
        narration: 'Staff Loan',
        chequeNo: null,
        chequeDate: null,
        bankName: null,
        bankBranch: null,
        isApprove: (await voucherAutoApproved(VoucherApproval.Loan)) ? 1 : 0,
        createdBy: actorId,
      });
    }
  }

  await db
    .update(applyLoans)
    .set({ approval, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(applyLoans.id, id));
}

/** `ApplyLoanRepository::loanUser()` - `User::whereHas('loans')`. */
export async function loanUsers() {
  const ids = await db
    .selectDistinct({ userId: applyLoans.userId })
    .from(applyLoans);
  if (!ids.length) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleName: roles.name,
      phone: staffs.phone,
      employeeId: staffs.employeeId,
    })
    .from(users)
    .leftJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(staffs, eq(staffs.userId, users.id))
    .where(
      inArray(
        users.id,
        ids.map((r) => r.userId),
      ),
    );
}

/** Totals for one staff member's loan history. */
export async function loanTotals(userId: number) {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${applyLoans.amount}), 0)`,
      paid: sql<number>`coalesce(sum(${applyLoans.paidLoanAmount}), 0)`,
    })
    .from(applyLoans)
    .where(and(eq(applyLoans.userId, userId), eq(applyLoans.approval, LoanApproval.Approved)));

  const total = Number(row?.total ?? 0);
  const paid = Number(row?.paid ?? 0);
  return { total, paid, due: total - paid };
}

/** `UserRepository::normalUser()` - the staff picker on the apply form. */
export async function loanApplicants(currentUserId: number) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(or(eq(users.id, currentUserId), eq(users.roleId, 3)));
}
