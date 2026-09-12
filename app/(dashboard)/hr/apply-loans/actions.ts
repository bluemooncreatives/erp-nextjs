'use server';

// Staff loan actions - port of Modules/Setup ApplyLoanController.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import {
  createLoan,
  updateLoan,
  deleteLoan,
  changeLoanApproval,
  type LoanInput,
} from '@/lib/hr/loans';
import { ROUTES } from '@/lib/routes';

export type LoanFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function money(formData: FormData, key: string): number {
  const n = Number(formData.get(key));
  return Number.isFinite(n) ? n : 0;
}

/** `ApplyLoanFormRequest` */
function validate(formData: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!str(formData, 'department_id')) errors.department_id = 'The department field is required.';
  if (!str(formData, 'title')) errors.title = 'The title field is required.';
  if (!str(formData, 'loan_type')) errors.loan_type = 'The loan type field is required.';
  if (!str(formData, 'amount')) errors.amount = 'The amount field is required.';
  if (!str(formData, 'total_month')) errors.total_month = 'The total month field is required.';
  return errors;
}

function inputFrom(formData: FormData, fallbackUserId: number): LoanInput {
  return {
    userId: Number(formData.get('user')) || fallbackUserId,
    departmentId: Number(formData.get('department_id')),
    title: str(formData, 'title'),
    loanType: str(formData, 'loan_type'),
    loanDate: str(formData, 'loan_date'),
    amount: money(formData, 'amount'),
    totalMonth: Number(formData.get('total_month')) || 0,
    monthlyInstallment: money(formData, 'monthly_installment'),
    note: str(formData, 'note') || null,
  };
}

/** `ApplyLoanController@store` */
export async function storeLoan(
  _prev: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const user = await requireUser();

  const fieldErrors = validate(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createLoan(inputFrom(formData, user.id), user.id);
    await successLog(`New Division - (${str(formData, 'title')}) has been created.`, user.id);
  } catch (error) {
    await errorLog(`${error} - Error has been detected for Loan Apply`, user.id);
    return { error: 'Something Went Wrong' };
  }

  redirect(ROUTES['apply_loans.index']);
}

/** `ApplyLoanController@update` */
export async function saveLoan(
  _prev: LoanFormState,
  formData: FormData,
): Promise<LoanFormState> {
  const user = await requireUser();
  const id = Number(formData.get('id'));

  const fieldErrors = validate(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await updateLoan(id, inputFrom(formData, user.id), user.id);
    await successLog(`Division - (${str(formData, 'title')}) has been updated.`, user.id);
  } catch (error) {
    await errorLog(`${error} - Error has been detected for Loan Apply update`, user.id);
    return { error: 'Something Went Wrong' };
  }

  redirect(ROUTES['apply_loans.index']);
}

/** `ApplyLoanController@destroy` */
export async function destroyLoan(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get('id'));

  try {
    await deleteLoan(id);
    await successLog('Applyied Loan has been destroyed.', user.id);
  } catch (error) {
    await errorLog(`${error} - Error has been detected for Division Destroy`, user.id);
  }

  revalidatePath(ROUTES['apply_loans.index']);
  revalidatePath(ROUTES['apply_loans.loan_approval_index']);
}

/** `ApplyLoanController@change_approval` */
export async function setLoanApproval(formData: FormData): Promise<void> {
  const user = await authorize('set_approval_applied_loan');
  const id = Number(formData.get('id'));
  const approval = Number(formData.get('approval'));

  try {
    await changeLoanApproval(id, approval, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['apply_loans.loan_approval_index']);
  revalidatePath(ROUTES['apply_loans.index']);
}
