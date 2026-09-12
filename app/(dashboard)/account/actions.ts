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
  deleteBankAccount,
  deleteExpense,
  deleteIncome,
  updateBankAccount,
  updateExpense,
  type ExpenseInput,
} from '@/lib/accounting/expenses';
import {
  approveAllVouchers,
  createVoucher,
  deleteVoucher,
  findVoucher,
  updateVoucher,
  setVoucherApproval,
  VoucherType,
  type VoucherTypeCode,
} from '@/lib/accounting/vouchers';
import { activeAccounts, createJournalVoucher, updateJournalVoucher as updateJournalEntry, type JournalInput } from '@/lib/accounting/journal';
import { isEnabled } from '@/lib/business-settings';
import { openAccountingPeriod } from '@/lib/accounting/periods';
import { createIncome, updateIncome, incomeAccounts, type IncomeInput } from '@/lib/accounting/income';

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
  input.paymentType = 'contra_voucher';
  input.isApprove = (await isEnabled('expense_voucher_approval')) ? 1 : 0;
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
  // ExpenseController::update explicitly uses CRV and a debit main account,
  // unlike its create action. Preserve this source behavior.
  input.paymentType = 'contra_voucher';
  input.voucherType = VoucherType.Contra;
  input.accountType = 'debit';

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
  return saveIncomeForm(formData, false);
}

export async function updateIncomeAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return saveIncomeForm(formData, true);
}

async function saveIncomeForm(formData: FormData, editing: boolean): Promise<AccountFormState> {
  const user = await authorize(editing ? 'income.edit' : 'income.store');
  const account = (await incomeAccounts()).find((row) => row.id === Number(formData.get('account_id')));
  if (!account) return { fieldErrors: { account_id: 'Select an income or bank account.' } };
  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return { fieldErrors: { amount: 'Enter an amount greater than zero.' } };
  const date = str(formData, 'date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return { fieldErrors: { date: 'Enter a valid date.' } };
  const input: IncomeInput = { accountId: account.id, accountType: ['1', '3'].includes(account.type ?? '') ? 'debit' : 'credit', amount, date,
    narration: str(formData, 'narration'), note: str(formData, 'note'), isApprove: (await isEnabled('expense_voucher_approval')) ? 1 : 0,
    showroomId: (await getSession())?.showroomId ?? null, createdBy: user.id };
  try {
    if (editing) await updateIncome(Number(formData.get('id')), input);
    else await createIncome(input);
    await successLog(editing ? 'Income updated' : 'Income created', user.id);
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

/** `VoucherController@store` - payment vouchers. Receipts have a separate action. */
export async function storeVoucher(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return savePaymentVoucher(formData, false);
}

export async function updatePaymentVoucher(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return savePaymentVoucher(formData, true);
}

async function savePaymentVoucher(formData: FormData, editing: boolean): Promise<AccountFormState> {
  const user = await authorize(editing ? 'vouchers.edit' : 'vouchers.store');
  const id = num(formData, 'id');
  if (editing) {
    const existing = Number.isSafeInteger(id) && id > 0 ? await findVoucher(id) : null;
    if (!existing || existing.paymentType !== 'voucher_payment') return { error: 'Payment voucher not found.' };
  }

  const debitAccountId = formData.getAll('debit_account_id').map(Number);
  const debitAmount = formData.getAll('debit_account_amount').map(Number);
  const debitNarration = strList(formData, 'debit_account_narration');
  const creditAccountId = num(formData, 'credit_account_id');
  const amount = debitAmount.reduce((a, b) => a + b, 0);

  const fieldErrors: Record<string, string> = {};
  if (!creditAccountId) fieldErrors.credit_account_id = 'Select the paying account.';
  if (debitAccountId.length === 0 || debitAccountId.some((accountId) => !Number.isSafeInteger(accountId) || accountId <= 0)) fieldErrors.debit_account_id = 'Select an account for every line.';
  if (debitAmount.length !== debitAccountId.length || debitAmount.some((value) => !Number.isFinite(value) || value < 0) || !Number.isFinite(amount) || amount <= 0) fieldErrors.debit_account_amount = 'Enter a valid amount for every line.';
  const date = str(formData, 'date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) fieldErrors.date = 'Enter a valid date.';
  const rawType = str(formData, 'voucher_type');
  if (rawType !== VoucherType.Cash && rawType !== VoucherType.Bank) fieldErrors.voucher_type = 'Select cash or bank voucher.';
  if (!editing) {
    const period = await openAccountingPeriod();
    if (period?.startDate && date < period.startDate) fieldErrors.date = 'Payment Date should be in this accounting period';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const voucherType = (str(formData, 'voucher_type') ?? VoucherType.Cash) as VoucherTypeCode;

  try {
    const input = {
      voucherType,
      amount,
      date,
      narration: str(formData, 'narration'),
      paymentType: 'voucher_payment',
      isApprove: (await isEnabled('voucher_payment_approval')) ? 1 : 0,
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
    };
    if (editing) await updateVoucher(id, input);
    else await createVoucher(input);
    await successLog(editing ? `Payment voucher updated: ${id}` : 'Voucher created', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['vouchers.index']);
  revalidatePath('/account/voucher', 'layout');
  redirect(ROUTES['vouchers.index']);
}

/** `JournalController@store` */
export async function storeJournalVoucher(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return saveCompoundVoucher(formData, 'journal', false);
}

export async function updateJournalVoucherAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  return saveCompoundVoucher(formData, 'journal', true);
}

export async function storeContraVoucher(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  return saveCompoundVoucher(formData, 'contra', false);
}

export async function updateContraVoucherAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  return saveCompoundVoucher(formData, 'contra', true);
}

async function saveCompoundVoucher(formData: FormData, kind: 'journal' | 'contra', editing: boolean): Promise<AccountFormState> {
  const user = await authorize(`${kind}.${editing ? 'edit' : 'store'}`);
  const paymentType = kind === 'journal' ? 'journal_voucher' : 'contra_voucher';
  const id = num(formData, 'id');
  if (editing) {
    const existing = Number.isSafeInteger(id) && id > 0 ? await findVoucher(id) : null;
    if (!existing || existing.paymentType !== paymentType) return { error: 'Voucher not found.' };
  }

  const subAccountId = formData.getAll('sub_account_id').map(Number);
  const subAmount = formData.getAll('sub_amount').map(Number);
  const subNarration = strList(formData, 'sub_narration');
  const accountId = num(formData, 'account_id');
  const amount = subAmount.reduce((a, b) => a + b, 0);
  const accountType = str(formData, 'account_type');
  const date = str(formData, 'date') ?? '';
  const mainAmount = Number(formData.get('main_amount'));
  const allowedAccounts = (await activeAccounts()).filter((account) => kind === 'contra' || editing || account.isGroup === 0);
  const allowedIds = new Set(allowedAccounts.map((account) => account.id));

  const fieldErrors: Record<string, string> = {};
  if (!allowedIds.has(accountId)) fieldErrors.account_id = 'Select the main account.';
  if (!subAccountId.length || subAccountId.some((value) => !allowedIds.has(value))) fieldErrors.sub_account_id = 'Select an account for every line.';
  if (subAccountId.length !== subAmount.length || subAmount.some((value) => !Number.isFinite(value) || value < 0) || !Number.isFinite(amount) || amount <= 0) fieldErrors.sub_amount = 'Enter a valid amount for every line.';
  if (!Number.isFinite(mainAmount) || Math.abs(mainAmount - amount) > 0.000001) fieldErrors.main_amount = 'Debit and Credit amount was mismatched.';
  if (accountType !== 'debit' && accountType !== 'credit') fieldErrors.account_type = 'Select debit or credit.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) fieldErrors.date = 'Enter a valid date.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const input: JournalInput = {
      voucherType: kind === 'contra' ? VoucherType.Contra : VoucherType.Journal,
      paymentType,
      amount,
      date,
      accountType: accountType as 'debit' | 'credit',
      accountId,
      mainAmount: amount,
      narration: str(formData, 'narration'),
      subAccountId,
      subAmount,
      subNarration,
      isApprove: (await isEnabled(`${paymentType}_approval`)) ? 1 : 0,
      createdBy: user.id,
    };
    if (editing) await updateJournalEntry(id, input);
    else await createJournalVoucher(input);
    await successLog(`${kind} voucher ${editing ? 'updated' : 'created'}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath('/account/voucher', 'layout');
  redirect(kind === 'journal' ? ROUTES['journal.index'] : ROUTES['contra.index']);
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
  revalidatePath(ROUTES['voucher_recieve.index']);
  revalidatePath(ROUTES['voucher_approval.index']);
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
  const allAccounts = await db.select().from(chartAccounts);
  const parent = allAccounts.find((account) => account.id === parentId);
  if (parentId && !parent) return { fieldErrors: { parent_id: 'Parent account not found.' } };
  if (id && !allAccounts.some((account) => account.id === id)) return { error: 'Account not found.' };
  const ancestors = new Set<number>();
  let cursor = parent;
  while (cursor) {
    if (cursor.id === id || ancestors.has(cursor.id)) return { fieldErrors: { parent_id: 'An account cannot be placed under itself or its descendants.' } };
    ancestors.add(cursor.id);
    cursor = allAccounts.find((account) => account.id === cursor!.parentId);
  }

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
      type: parent?.type ?? type!,
      description: str(formData, 'description'),
      parentId,
      isGroup,
      level: parent ? Number(parent.level ?? 0) + 1 : 1,
      status: num(formData, 'status', 1),
      configurationGroupId: formData.get('configuration_group_id')
        ? num(formData, 'configuration_group_id')
        : null,
      createdBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ChartAccountRepository extends the complete parent code, including all ancestors.
    const newId = Number(inserted.insertId);
    await db
      .update(chartAccounts)
      .set({
        code: parent
          ? `${parent.code}-${String(newId).padStart(2, '0')}`
          : `0${type}-${String(newId).padStart(2, '0')}`,
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
