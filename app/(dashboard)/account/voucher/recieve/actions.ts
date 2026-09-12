'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { receiveByAccounts, receiveFromAccounts } from '@/lib/accounting/accounts';
import { createVoucher, findVoucher, updateVoucher } from '@/lib/accounting/vouchers';
import { receiptInvoiceOptions } from '@/lib/accounting/receipts';
import { isEnabled } from '@/lib/business-settings';
import { MorphType } from '@/lib/db/morph';
import { successLog, errorLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import type { AccountFormState } from '../../actions';

export async function loadReceiptInvoices(accountId: number) {
  await authorize('voucher_recieve.store');
  const accounts = await receiveFromAccounts();
  if (!accounts.some((account) => account.id === accountId)) return [];
  return receiptInvoiceOptions(accountId);
}

/** VoucherRecieveController::store/update. Updates retain the original invoice link. */
export async function saveReceiptVoucher(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = Number(formData.get('id') || 0);
  const user = await authorize(id ? 'voucher_recieve.edit' : 'voucher_recieve.store');
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  const creditAccountId = Number(formData.get('credit_account_id'));
  const debitAccountId = Number(formData.get('debit_account_id'));
  const amount = Number(formData.get('debit_account_amount'));
  const date = text('date');
  const invoiceId = Number(formData.get('invoice_id') || 0);
  const fieldErrors: Record<string, string> = {};

  const [fromAccounts, byAccounts] = await Promise.all([receiveFromAccounts(), receiveByAccounts()]);
  const receivingAccount = byAccounts.find((account) => account.id === debitAccountId);
  if (!fromAccounts.some((account) => account.id === creditAccountId)) fieldErrors.credit_account_id = 'Select the account received from.';
  if (!receivingAccount) fieldErrors.debit_account_id = 'Select the receiving account.';
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.debit_account_amount = 'Enter an amount greater than zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) fieldErrors.date = 'Enter a valid date.';
  if (!id && invoiceId && !(await receiptInvoiceOptions(creditAccountId)).some((invoice) => invoice.value === invoiceId)) fieldErrors.invoice_id = 'Select an invoice for this account.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    if (id) {
      const existing = await findVoucher(id);
      if (!existing || existing.paymentType !== 'voucher_recieve') return { error: 'Receipt voucher not found.' };
    }
    const input = {
      voucherType: receivingAccount!.configurationGroupId === 1 ? 'CV' as const : 'BV' as const,
      amount, date, creditAccountId, debitAccountId,
      paymentType: 'voucher_recieve',
      narration: text('narration') || null,
      isApprove: (await isEnabled('voucher_recieve_approval')) ? 1 : 0,
      bankName: text('bank_name') || null,
      bankBranch: text('bank_branch') || null,
      chequeNo: text('cheque_no') || null,
      chequeDate: text('cheque_date') || null,
      referableId: invoiceId || null,
      referableType: invoiceId ? MorphType.Sale : null,
      createdBy: user.id,
    };
    if (id) await updateVoucher(id, input);
    else await createVoucher(input);
    await successLog(id ? `Receipt voucher updated: ${id}` : 'Receipt voucher created', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
  revalidatePath(ROUTES['voucher_recieve.index']);
  revalidatePath('/account/voucher', 'layout');
  redirect(ROUTES['voucher_recieve.index']);
}
