'use server';

// Money transfer actions - port of Modules/Account TransferController.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import {
  createTransferVoucher,
  updateTransferVoucher,
  type TransferInput,
} from '@/lib/accounting/transfers';
import { isEnabled } from '@/lib/business-settings';
import { toDateString, today } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { actionFormData } from '@/lib/forms';

export type TransferFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? '').trim();
  return value === '' ? null : value;
}

/**
 * Both the store and update paths read the same posted arrays. The PHP summed
 * the destination amounts into the voucher total and took the first destination
 * narration as the voucher narration; the shared `VoucherForm` posts those under
 * `account_id` / `sub_*`, so the same values arrive under those names here.
 */
async function inputFrom(
  formData: FormData,
  accountType: 'debit' | 'credit',
  userId: number,
): Promise<TransferInput | { fieldErrors: Record<string, string> }> {
  const mainAccountId = Number(formData.get('account_id'));

  const subAccountId = formData
    .getAll('sub_account_id')
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  const subAmount = formData.getAll('sub_amount').map((v) => Number(v) || 0);
  const subNarration = formData.getAll('sub_narration').map((v) => String(v));

  const fieldErrors: Record<string, string> = {};
  if (!mainAccountId) fieldErrors.account_id = 'Select the source account.';
  if (!subAccountId.length) fieldErrors.sub_account_id = 'Add at least one destination.';
  if (subAmount.reduce((a, b) => a + b, 0) <= 0) {
    fieldErrors.sub_account_id = 'Enter an amount.';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const subTotal = subAmount.reduce((sum, amount) => sum + amount, 0);

  return {
    amount: subTotal,
    date: toDateString(str(formData, 'date')) ?? today(),
    accountType,
    accountId: mainAccountId,
    mainAmount: subTotal,
    narration: subNarration[0] ?? null,
    subAccountId,
    subAmount,
    subNarration,
    isApprove: (await isEnabled('contra_voucher_approval')) ? 1 : 0,
    chequeNo: str(formData, 'cheque_no'),
    chequeDate: toDateString(str(formData, 'cheque_date')),
    bankName: str(formData, 'bank_name'),
    bankBranch: str(formData, 'bank_branch'),
    createdBy: userId,
  };
}

/** `TransferController@showroom_store` - posts with `account_type = credit`. */
export async function storeTransfer(
  _prev: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('transfer_showroom.store');

  const input = await inputFrom(formData, 'credit', user.id);
  if ('fieldErrors' in input) return input;

  try {
    await createTransferVoucher(input);
    await successLog('Money Transfer Successfully.', user.id);
  } catch (error) {
    await errorLog(`${error} - Error has been detected for Journal creation`, user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['transfer_showroom.index']);
  return { success: 'Contra Voucher has been added Successfully' };
}

/** `TransferController@update` - posts with `account_type = debit`. */
export async function saveTransfer(
  _prev: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('transfer_showroom.update');
  const id = Number(formData.get('id'));

  const input = await inputFrom(formData, 'debit', user.id);
  if ('fieldErrors' in input) return input;

  try {
    await updateTransferVoucher(id, input);
    await successLog('Transfer Info been updated Successfully.', user.id);
  } catch (error) {
    await errorLog(`${error} - Error has been detected for Voucher Payment update`, user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['transfer_showroom.index']);
  redirect(ROUTES['transfer_showroom.index']);
}
