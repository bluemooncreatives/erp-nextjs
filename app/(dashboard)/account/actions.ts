'use server';

// ---------------------------------------------------------------------------
// Account module server actions - ports of ExpenseController, IncomeController,
// BankAccountController, VoucherController, JournalController,
// ContraVoucherController and ChartAccountController.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import { db } from '@/lib/db/client';
import { chartAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  createBankAccount,
  createExpense,
  createIncome,
  deleteBankAccount,
  deleteExpense,
  deleteIncome,
  updateBankAccount,
  updateExpense,
  updateIncome,
  type ExpenseInput,
} from '@/lib/accounting/expenses';
import {
  approveAllVouchers,
  createVoucher,
  deleteVoucher,
  setVoucherApproval,
  VoucherType,
  type VoucherTypeCode,
} from '@/lib/accounting/vouchers';
import { createJournalVoucher } from '@/lib/accounting/journal';

export type AccountFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function num(formData: FormData, key: string, fallback = 0): number {
  const raw = formData.get(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

function numList(formData: FormData, key: string): number[] {
  return formData.getAll(key).map((v) => Number(v)).filter(Number.isFinite);
}

function strList(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String);
}

/**
 * Read the shared expense/income form. The payment method decides the voucher
 * type: cash -> CV, bank -> BV.
 */
async function readExpenseInput(formData: FormData): Promise<ExpenseInput> {
  const session = await getSession();
  const method = str(formData, 'payment_method') ?? 'cash';
  const voucherType: VoucherTypeCode =
    method === 'bank' ? VoucherType.Bank : VoucherType.Cash;

  const subAccountId = numList(formData, 'sub_account_id');
  const subAmount = numList(formData, 'sub_amount');
  const subNarration = strList(formData, 'sub_narration');

  const amount = subAmount.reduce((a, b) => a + b, 0);

  return {
    voucherType,
    amount,
    date: String(formData.get('date') ?? ''),
    narration: str(formData, 'narration'),
    paymentType: String(formData.get('payment_type') ?? 'voucher_payment'),
    isApprove: 1,
    accountType: (str(formData, 'account_type') ?? 'debit') as 'debit' | 'credit',
    accountId: num(formData, 'account_id'),
    mainAmount: amount,
    subAccountId,
    subAmount,
    subNarration,
    bankName: str(formData, 'bank_name'),
    bankBranch: str(formData, 'bank_branch'),
    chequeNo: str(formData, 'cheque_no'),
    chequeDate: str(formData, 'cheque_date'),
    showroomId: session?.showroomId ?? null,
  };
}

function validateVoucherForm(input: ExpenseInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.accountId) errors.account_id = 'Select the paying account.';
  if (!input.date) errors.date = 'The date field is required.';
  if (input.subAccountId.length === 0) errors.sub_account_id = 'Add at least one line.';
  if (input.amount <= 0) errors.sub_amount = 'Enter an amount greater than zero.';
  return Object.keys(errors).length ? errors : null;
}

// --- Expenses --------------------------------------------------------------

export async function storeExpense(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await authorize('expenses.store');
  const input = await readExpenseInput(formData);
  input.paymentType = 'voucher_payment';
  // An expense credits the paying account and debits the expense accounts.
  input.accountType = 'credit';

  const fieldErrors = validateVoucherForm(input);
  if (fieldErrors) return { fieldErrors };

  try {
    await createExpense({ ...input, createdBy: user.id });
    await successLog('Expense created', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['expenses.index']);
  redirect(ROUTES['expenses.index']);
}

export async function updateExpenseAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = Number(formData.get('id'));
  const user = await authorize('expenses.edit');

  const input = await readExpenseInput(formData);
  input.paymentType = 'voucher_payment';
  input.accountType = 'credit';

  const fieldErrors = validateVoucherForm(input);
  if (fieldErrors) return { fieldErrors };

  try {
    await updateExpense(id, { ...input, createdBy: user.id });
    await successLog(`Expense updated: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['expenses.index']);
  redirect(ROUTES['expenses.index']);
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('expenses.delete');
  await deleteExpense(id);
  await successLog(`Expense deleted: ${id}`, user.id);
  revalidatePath(ROUTES['expenses.index']);
}

// --- Income ----------------------------------------------------------------

export async function storeIncome(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await authorize('income.store');
  const input = await readExpenseInput(formData);
  input.paymentType = 'voucher_recieve';
  // Income debits the receiving account and credits the income accounts.
  input.accountType = 'debit';

  const fieldErrors = validateVoucherForm(input);
  if (fieldErrors) return { fieldErrors };

  try {
    await createIncome({ ...input, createdBy: user.id });
    await successLog('Income created', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['income.index']);
  redirect(ROUTES['income.index']);
}

export async function updateIncomeAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = Number(formData.get('id'));
  const user = await authorize('income.edit');

  const input = await readExpenseInput(formData);
  input.paymentType = 'voucher_recieve';
  input.accountType = 'debit';

  const fieldErrors = validateVoucherForm(input);
  if (fieldErrors) return { fieldErrors };

  try {
    await updateIncome(id, { ...input, createdBy: user.id });
    await successLog(`Income updated: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['income.index']);
  redirect(ROUTES['income.index']);
}

export async function deleteIncomeAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('income.delete');
  await deleteIncome(id);
  await successLog(`Income deleted: ${id}`, user.id);
  revalidatePath(ROUTES['income.index']);
}

// --- Bank accounts ---------------------------------------------------------

export async function saveBankAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const bankName = String(formData.get('bank_name') ?? '').trim();
  if (!bankName) return { fieldErrors: { bank_name: 'The bank name is required.' } };

  const user = await authorize(id ? 'bank_accounts.edit' : 'bank_accounts.store');

  const values = {
    bankName,
    branchName: str(formData, 'branch_name'),
    accountName: str(formData, 'account_name'),
    accountNo: str(formData, 'account_no'),
    description: str(formData, 'description'),
  };

  try {
    if (id) {
      await updateBankAccount(id, values, user.id);
      revalidatePath(ROUTES['bank_accounts.index']);
      return { success: 'Bank Account Updated Successfully' };
    }
    await createBankAccount(values, user.id);
    revalidatePath(ROUTES['bank_accounts.index']);
    return { success: 'Bank Account Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteBankAccountAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('bank_accounts.delete');
  await deleteBankAccount(id);
  await successLog(`Bank account deleted: ${id}`, user.id);
  revalidatePath(ROUTES['bank_accounts.index']);
}

// --- Vouchers --------------------------------------------------------------

/** `VoucherController@store` - a payment or receipt voucher. */
export async function storeVoucher(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await authorize('vouchers.store');

  const debitAccountId = numList(formData, 'debit_account_id');
  const debitAmount = numList(formData, 'debit_account_amount');
  const debitNarration = strList(formData, 'debit_account_narration');
  const creditAccountId = num(formData, 'credit_account_id');
  const amount = debitAmount.reduce((a, b) => a + b, 0);

  const fieldErrors: Record<string, string> = {};
  if (!creditAccountId) fieldErrors.credit_account_id = 'Select the paying account.';
  if (debitAccountId.length === 0) fieldErrors.debit_account_id = 'Add at least one line.';
  if (amount <= 0) fieldErrors.debit_account_amount = 'Enter an amount.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const voucherType = (str(formData, 'voucher_type') ?? VoucherType.Cash) as VoucherTypeCode;

  try {
    await createVoucher({
      voucherType,
      amount,
      date: String(formData.get('date') ?? ''),
      narration: str(formData, 'narration'),
      paymentType: str(formData, 'payment_type') ?? 'voucher_payment',
      isApprove: num(formData, 'is_approve', 1),
      debitAccountId,
      debitAccountAmount: debitAmount,
      debitAccountNarration: debitNarration,
      creditAccountId,
      creditAccountAmount: amount,
      bankName: str(formData, 'bank_name'),
      bankBranch: str(formData, 'bank_branch'),
      chequeNo: str(formData, 'cheque_no'),
      chequeDate: str(formData, 'cheque_date'),
      createdBy: user.id,
    });
    await successLog('Voucher created', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['vouchers.index']);
  redirect(ROUTES['vouchers.index']);
}

/** `JournalController@store` */
export async function storeJournalVoucher(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await authorize('journal.store');

  const subAccountId = numList(formData, 'sub_account_id');
  const subAmount = numList(formData, 'sub_amount');
  const subNarration = strList(formData, 'sub_narration');
  const accountId = num(formData, 'account_id');
  const amount = subAmount.reduce((a, b) => a + b, 0);

  const fieldErrors: Record<string, string> = {};
  if (!accountId) fieldErrors.account_id = 'Select the main account.';
  if (subAccountId.length === 0) fieldErrors.sub_account_id = 'Add at least one line.';
  if (amount <= 0) fieldErrors.sub_amount = 'Enter an amount.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createJournalVoucher({
      amount,
      date: String(formData.get('date') ?? ''),
      accountType: (str(formData, 'account_type') ?? 'debit') as 'debit' | 'credit',
      accountId,
      mainAmount: amount,
      narration: str(formData, 'narration'),
      subAccountId,
      subAmount,
      subNarration,
      isApprove: num(formData, 'is_approve', 1),
      createdBy: user.id,
    });
    await successLog('Journal voucher created', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['journal.index']);
  redirect(ROUTES['journal.index']);
}

/** `ContraVoucherController@store` - moves money between two own accounts. */
export async function storeContraVoucher(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await authorize('contra.store');

  const fromAccountId = num(formData, 'from_account_id');
  const toAccountId = num(formData, 'to_account_id');
  const amount = num(formData, 'amount');

  const fieldErrors: Record<string, string> = {};
  if (!fromAccountId) fieldErrors.from_account_id = 'Select the source account.';
  if (!toAccountId) fieldErrors.to_account_id = 'Select the destination account.';
  if (fromAccountId === toAccountId) {
    fieldErrors.to_account_id = 'The two accounts must differ.';
  }
  if (amount <= 0) fieldErrors.amount = 'Enter an amount.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createVoucher({
      voucherType: VoucherType.Contra,
      amount,
      date: String(formData.get('date') ?? ''),
      narration: str(formData, 'narration'),
      paymentType: 'contra_voucher',
      isApprove: num(formData, 'is_approve', 1),
      // Money arrives in the destination (Dr) and leaves the source (Cr).
      debitAccountId: toAccountId,
      creditAccountId: fromAccountId,
      isTransfer: 1,
      createdBy: user.id,
    });
    await successLog('Contra voucher created', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['contra.index']);
  redirect(ROUTES['contra.index']);
}

/** `VoucherController@approval_status` */
export async function setVoucherApprovalAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const status = Number(formData.get('status'));
  const user = await authorize('set_voucher_approval');

  await setVoucherApproval(id, status, user.id);
  await successLog(`Voucher ${id} approval set to ${status}`, user.id);

  revalidatePath(ROUTES['voucher_approval.index']);
}

/** `VoucherController@allApproval` */
export async function approveAllVouchersAction(): Promise<void> {
  const user = await authorize('voucher.all.approval');
  await approveAllVouchers();
  await successLog('All pending vouchers approved', user.id);
  revalidatePath(ROUTES['voucher_approval.index']);
}

export async function deleteVoucherAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('vouchers.destroy');
  await deleteVoucher(id);
  await successLog(`Voucher deleted: ${id}`, user.id);
  revalidatePath(ROUTES['vouchers.index']);
}

// --- Chart of accounts -----------------------------------------------------

export async function saveChartAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const name = String(formData.get('name') ?? '').trim();
  const type = str(formData, 'type');

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'The name field is required.';
  if (!type) fieldErrors.type = 'Select the account type.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const user = await authorize(id ? 'char_accounts.edit' : 'char_accounts.store');

  const parentId = formData.get('parent_id') ? num(formData, 'parent_id') : null;
  const isGroup = formData.get('is_group') ? 1 : 0;

  try {
    if (id) {
      await db
        .update(chartAccounts)
        .set({
          name,
          type: type!,
          description: str(formData, 'description'),
          parentId,
          isGroup,
          status: num(formData, 'status', 1),
          configurationGroupId: formData.get('configuration_group_id')
            ? num(formData, 'configuration_group_id')
            : null,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(chartAccounts.id, id));

      revalidatePath(ROUTES['char_accounts.index']);
      return { success: 'Account Updated Successfully' };
    }

    const [inserted] = await db.insert(chartAccounts).values({
      name,
      type: type!,
      description: str(formData, 'description'),
      parentId,
      isGroup,
      level: parentId ? 2 : 1,
      status: num(formData, 'status', 1),
      configurationGroupId: formData.get('configuration_group_id')
        ? num(formData, 'configuration_group_id')
        : null,
      createdBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // The code follows the seeded convention: 0<type>-<parent>-<id>.
    const newId = Number(inserted.insertId);
    await db
      .update(chartAccounts)
      .set({
        code: parentId
          ? `0${type}-${String(parentId).padStart(2, '0')}-${newId}`
          : `0${type}-${newId}`,
      })
      .where(eq(chartAccounts.id, newId));

    revalidatePath(ROUTES['char_accounts.index']);
    return { success: 'Account Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteChartAccountAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('char_accounts.destroy');

  // An account carrying postings must not be removed.
  const { transactions } = await import('@/lib/db/schema');
  const { sql: raw } = await import('drizzle-orm');
  const [row] = await db
    .select({ count: raw<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.accountId, id));

  if (Number(row?.count ?? 0) > 0) {
    await errorLog(`Chart account ${id} not deleted - it has transactions`, user.id);
    return;
  }

  await db.delete(chartAccounts).where(eq(chartAccounts.id, id));
  await successLog(`Chart account deleted: ${id}`, user.id);
  revalidatePath(ROUTES['char_accounts.index']);
}

