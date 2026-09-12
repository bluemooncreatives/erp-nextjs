'use server';

// ---------------------------------------------------------------------------
// The "Add balance" / "Subtract balance" forms on a contact's detail screen.
// Port of ContactController@addBalanceCustomer, @addBalanceSupplier and
// @minusBalance.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { isEnabled } from '@/lib/business-settings';
import { createVoucher } from '@/lib/accounting/vouchers';
import { createJournalVoucher } from '@/lib/accounting/journal';
import { findContactAccount, receiveByAccounts } from '@/lib/accounting/accounts';
import { MorphType } from '@/lib/db/morph';
import { route } from '@/lib/routes';

export type BalanceFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}

/**
 * `addBalanceCustomer()` - a receipt voucher crediting the customer's account
 * and debiting the cash or bank account money came in to. The voucher type
 * follows the receiving account's configuration group, as `voucher_type == 1`
 * did in the PHP (1 = cash, anything else = bank).
 */
export async function addCustomerBalance(
  _previous: BalanceFormState,
  formData: FormData,
): Promise<BalanceFormState> {
  const contactId = Number(formData.get('contact_id'));
  const user = await authorize('voucher_recieve.store');

  const date = text(formData, 'date');
  const amount = Number(formData.get('debit_account_amount'));
  const debitAccountId = Number(formData.get('debit_account_id'));
  const narration = text(formData, 'debit_account_narration') || null;

  const fieldErrors: Record<string, string> = {};
  if (!isDate(date)) fieldErrors.date = 'Enter a valid date.';
  if (!Number.isFinite(amount) || amount <= 0) {
    fieldErrors.debit_account_amount = 'Enter an amount greater than zero.';
  }

  const receiving = (await receiveByAccounts()).find((a) => a.id === debitAccountId);
  if (!receiving) fieldErrors.debit_account_id = 'Select the receiving account.';

  const creditAccount = await findContactAccount(contactId, MorphType.ContactModel);
  if (!creditAccount) return { error: 'This contact has no chart account.' };

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createVoucher({
      voucherType: receiving!.configurationGroupId === 1 ? 'CV' : 'BV',
      amount,
      date,
      paymentType: 'voucher_recieve',
      creditAccountId: creditAccount.id,
      creditAccountAmount: amount,
      creditAccountNarration: [narration],
      debitAccountId: [debitAccountId],
      debitAccountAmount: [amount],
      debitAccountNarration: [narration],
      narration,
      chequeNo: text(formData, 'cheque_no') || null,
      chequeDate: text(formData, 'cheque_date') || null,
      bankName: text(formData, 'bank_name') || null,
      bankBranch: text(formData, 'bank_branch') || null,
      isApprove: (await isEnabled('add_balance_voucher_approval')) ? 1 : 0,
      createdBy: user.id,
    });
    await successLog('Balance has been added Successfully !!!.', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(route('customer.view', { id: contactId }));
  return { success: 'Balance has been added Successfully' };
}

/**
 * `addBalanceSupplier()` - the same shape as the customer form, but a payment
 * voucher: the supplier's account is debited and the cash or bank account the
 * money left is credited.
 */
export async function addSupplierBalance(
  _previous: BalanceFormState,
  formData: FormData,
): Promise<BalanceFormState> {
  const contactId = Number(formData.get('contact_id'));
  const user = await authorize('vouchers.store');

  const date = text(formData, 'date');
  const amount = Number(formData.get('debit_account_amount'));
  const creditAccountId = Number(formData.get('credit_account_id'));
  const narration = text(formData, 'debit_account_narration') || null;

  const fieldErrors: Record<string, string> = {};
  if (!isDate(date)) fieldErrors.date = 'Enter a valid date.';
  if (!Number.isFinite(amount) || amount <= 0) {
    fieldErrors.debit_account_amount = 'Enter an amount greater than zero.';
  }

  const paying = (await receiveByAccounts()).find((a) => a.id === creditAccountId);
  if (!paying) fieldErrors.credit_account_id = 'Select the paying account.';

  const debitAccount = await findContactAccount(contactId, MorphType.ContactModel);
  if (!debitAccount) return { error: 'This contact has no chart account.' };

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createVoucher({
      voucherType: paying!.configurationGroupId === 1 ? 'CV' : 'BV',
      amount,
      date,
      paymentType: 'voucher_payment',
      creditAccountId,
      creditAccountAmount: amount,
      creditAccountNarration: [narration],
      debitAccountId: [debitAccount.id],
      debitAccountAmount: [amount],
      debitAccountNarration: [narration],
      narration: text(formData, 'narration') || null,
      chequeNo: text(formData, 'cheque_no') || null,
      chequeDate: text(formData, 'cheque_date') || null,
      bankName: text(formData, 'bank_name') || null,
      bankBranch: text(formData, 'bank_branch') || null,
      isApprove: (await isEnabled('add_balance_voucher_approval')) ? 1 : 0,
      createdBy: user.id,
    });
    await successLog('Balance has been added Successfully !!!.', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(route('supplier.view', { id: contactId }));
  return { success: 'Balance has been added Successfully' };
}

/**
 * `minusBalance()` - a journal voucher. Both modals post an `account_type`
 * that is not the string 'debit' (the customer modal sends 'credit', the
 * supplier one the misspelled 'dedit'), so `trranactionEntry()` takes the same
 * branch either way: the chosen account is credited and the contact's account
 * is debited.
 */
export async function subtractContactBalance(
  _previous: BalanceFormState,
  formData: FormData,
): Promise<BalanceFormState> {
  const contactId = Number(formData.get('contact_id'));
  const user = await authorize('journal.store');

  const date = text(formData, 'date');
  const amount = Number(formData.get('sub_amount'));
  const accountId = Number(formData.get('account_id'));
  const narration = text(formData, 'narration') || null;

  const fieldErrors: Record<string, string> = {};
  if (!isDate(date)) fieldErrors.date = 'Enter a valid date.';
  if (!Number.isFinite(amount) || amount <= 0) {
    fieldErrors.sub_amount = 'Enter an amount greater than zero.';
  }
  if (!Number.isFinite(accountId) || accountId <= 0) {
    fieldErrors.account_id = 'Select an account.';
  }

  const subAccount = await findContactAccount(contactId, MorphType.ContactModel);
  if (!subAccount) return { error: 'This contact has no chart account.' };

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createJournalVoucher({
      voucherType: 'JV',
      amount,
      date,
      accountType: 'credit',
      paymentType: 'journal_voucher',
      accountId,
      mainAmount: amount,
      narration,
      subAccountId: [subAccount.id],
      subAmount: [amount],
      subNarration: [narration],
      isApprove: (await isEnabled('substraction_balance_voucher_approval')) ? 1 : 0,
      createdBy: user.id,
    });
    await successLog('Journal has been Added.', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(route('customer.view', { id: contactId }));
  revalidatePath(route('supplier.view', { id: contactId }));
  return { success: 'Journal has been added Successfully' };
}
