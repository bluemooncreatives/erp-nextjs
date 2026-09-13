'use server';

// Leave, attendance, holiday and payroll server actions.
// Ports Modules/Leave, Modules/Attendance and Modules/Payroll controllers.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize, requireUser } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { notifyPayroll } from '@/lib/notifications/documents';
import { findStaff } from '@/lib/hr/staff';
import { ROUTES } from '@/lib/routes';
import { fileFrom, saveUpload } from '@/lib/uploads';
import {
  LeaveStatus,
  createLeaveApplication,
  createPayroll,
  deleteHoliday,
  deleteLeaveApplication,
  deleteLeaveDefine,
  deletePayroll,
  leaveTypeRepository,
  payPayroll,
  saveAttendance,
  saveHoliday,
  saveLeaveDefine,
  setLeaveApproval,
  updateLeaveApplication,
  type LeaveInput,
  PayrollLineKind,
  type PayrollLine,
  type PayrollPaymentInput,
} from '@/lib/hr/leave';
import type { ReferenceFormState } from '@/components/erp/reference-crud';
import { actionFormData } from '@/lib/forms';

export type LeaveFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

function num(formData: FormData, key: string, fallback = 0): number {
  const raw = formData.get(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// --- Leave types -----------------------------------------------------------

export async function saveLeaveType(
  _prev: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  formData = actionFormData(_prev, formData);
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { fieldErrors: { name: 'The name field is required.' } };

  const user = await authorize(id ? 'leave_types.edit' : 'leave_types.store');

  try {
    const values = { name, status: num(formData, 'status', 1) };
    if (id) {
      await leaveTypeRepository.update(id, values, user.id);
      revalidatePath(ROUTES['leave_types.index']);
      return { success: 'Leave Type Updated Successfully' };
    }
    await leaveTypeRepository.create(values, user.id);
    revalidatePath(ROUTES['leave_types.index']);
    return { success: 'Leave Type Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteLeaveType(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('leave_types.delete');
  await leaveTypeRepository.remove(id);
  revalidatePath(ROUTES['leave_types.index']);
}

// --- Leave definitions -----------------------------------------------------

export async function storeLeaveDefine(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('leave_define.store');

  const roleId = num(formData, 'role_id');
  const leaveTypeId = num(formData, 'leave_type_id');
  const totalDays = num(formData, 'total_days');

  const fieldErrors: Record<string, string> = {};
  if (!roleId) fieldErrors.role_id = 'Select a role.';
  if (!leaveTypeId) fieldErrors.leave_type_id = 'Select a leave type.';
  if (totalDays <= 0) fieldErrors.total_days = 'Enter the number of days.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await saveLeaveDefine(
      {
        id: formData.get('id') ? Number(formData.get('id')) : null,
        roleId,
        leaveTypeId,
        totalDays,
        maxForward: num(formData, 'max_forward'),
        balanceForward: formData.get('balance_forward') ? 1 : 0,
        year: num(formData, 'year', new Date().getUTCFullYear()),
      },
      user.id,
    );
    revalidatePath(ROUTES['leave_define.index']);
    return { success: 'Leave definition saved.' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function removeLeaveDefine(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('leave_define.delete');
  await deleteLeaveDefine(id);
  revalidatePath(ROUTES['leave_define.index']);
}

// --- Leave applications ----------------------------------------------------

async function readLeaveInput(formData: FormData, userId: number): Promise<LeaveInput> {
  return {
    userId: formData.get('user') ? num(formData, 'user') : userId,
    leaveTypeId: num(formData, 'leave_type_id'),
    reason: String(formData.get('reason') ?? '').trim(),
    applyDate: String(formData.get('apply_date') ?? ''),
    startDate: String(formData.get('start_date') ?? ''),
    endDate: str(formData, 'end_date'),
    day: num(formData, 'day', 1),
    leaveFrom: formData.get('half') ? 1 : 0,
    leaveTo: formData.get('half_to') ? 1 : 0,
    makeupLeave: formData.get('makeup_leave') ? 1 : 0,
    makeupDate: str(formData, 'makeup_date'),
    makeupHalf: formData.get('makeup_half') ? 1 : 0,
    attachment: await saveUpload(fileFrom(formData, 'file'), 'leave'),
  };
}

export async function storeLeaveApplication(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  formData = actionFormData(_prev, formData);
  const user = await requireUser();
  const input = await readLeaveInput(formData, user.id);

  const fieldErrors: Record<string, string> = {};
  if (!input.leaveTypeId) fieldErrors.leave_type_id = 'Select a leave type.';
  if (!input.reason) fieldErrors.reason = 'The reason field is required.';
  if (!input.startDate) fieldErrors.start_date = 'The start date is required.';
  if (input.day === 2 && !input.endDate) {
    fieldErrors.end_date = 'The end date is required for a range.';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await createLeaveApplication(input, user.id);
    await successLog('Leave application submitted', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['apply_leave.index']);
  redirect(ROUTES['apply_leave.index']);
}

export async function updateLeaveApplicationAction(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  formData = actionFormData(_prev, formData);
  const id = Number(formData.get('id'));
  const user = await requireUser();
  const input = await readLeaveInput(formData, user.id);

  try {
    await updateLeaveApplication(id, input, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['apply_leave.index']);
  redirect(ROUTES['apply_leave.index']);
}

/** `set_approval_leave` */
export async function setLeaveApprovalAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const status = Number(formData.get('status'));
  const user = await authorize('set_approval_leave');

  await setLeaveApproval(id, status, user.id);
  await successLog(
    `Leave ${id} ${status === LeaveStatus.Approved ? 'approved' : 'rejected'}`,
    user.id,
  );

  revalidatePath(ROUTES['approved_index']);
  revalidatePath(ROUTES['pending_index']);
  revalidatePath(ROUTES['apply_leave.index']);
}

export async function deleteLeaveApplicationAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await requireUser();
  await deleteLeaveApplication(id);
  revalidatePath(ROUTES['apply_leave.index']);
}

// --- Attendance ------------------------------------------------------------

export async function storeAttendance(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('attendances.store');

  const date = String(formData.get('date') ?? '');
  if (!date) return { fieldErrors: { date: 'Select a date.' } };

  const userIds = formData.getAll('user_id').map((v) => Number(v));
  const marks = formData.getAll('attendance').map(String);
  const notes = formData.getAll('note').map(String);
  const roleId = num(formData, 'role_id', 1);

  const entries = userIds.map((userId, i) => ({
    userId,
    roleId,
    mark: marks[i] ?? 'P',
    note: notes[i] || null,
  }));

  try {
    await saveAttendance(entries, date, user.id);
    await successLog(`Attendance saved for ${date}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['attendances.index']);
  return { success: 'Attendance saved.' };
}

// --- Holidays --------------------------------------------------------------

export async function storeHoliday(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('holidays.store');

  const name = String(formData.get('name') ?? '').trim();
  const type = num(formData, 'type', 0);
  const from = String(formData.get('date') ?? '');
  const to = str(formData, 'end_date');

  if (!name) return { fieldErrors: { name: 'The name field is required.' } };
  if (!from) return { fieldErrors: { date: 'Select a date.' } };

  // A range holiday stores "from,to" in the single `date` column.
  const date = type === 1 && to ? `${from},${to}` : from;

  try {
    await saveHoliday({
      id: formData.get('id') ? Number(formData.get('id')) : null,
      name,
      type,
      date,
      year: Number(from.slice(0, 4)) || new Date().getUTCFullYear(),
    });
    revalidatePath(ROUTES['holidays.index']);
    return { success: 'Holiday saved.' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function removeHoliday(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('holidays.destroy');
  await deleteHoliday(id);
  revalidatePath(ROUTES['holidays.index']);
}

// --- Payroll ---------------------------------------------------------------

export async function storePayroll(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('save_payroll');

  const staffId = num(formData, 'staff_id');
  if (!staffId) return { fieldErrors: { staff_id: 'Select a staff member.' } };

  const typeNames = formData.getAll('type_name').map(String);
  const amounts = formData.getAll('amount').map((v) => Number(v));
  const kinds = formData.getAll('earn_dedc_type').map(String);
  const loanIds = formData.getAll('loan_id').map(String);

  const lines: PayrollLine[] = typeNames
    .map((typeName, i) => ({
      typeName,
      amount: amounts[i] ?? 0,
      earnDedcType: kinds[i] ?? PayrollLineKind.Earning,
      loanId: loanIds[i] ? Number(loanIds[i]) : undefined,
    }))
    .filter((l) => l.typeName && l.amount > 0);

  try {
    const payrollId = await createPayroll(
      {
        staffId,
        roleId: num(formData, 'role_id', 1),
        basicSalary: num(formData, 'basic_salary'),
        tax: num(formData, 'tax'),
        payrollMonth: String(formData.get('payroll_month') ?? ''),
        payrollYear: String(formData.get('payroll_year') ?? ''),
        paymentMode: str(formData, 'payment_mode'),
        paymentDate: str(formData, 'payment_date'),
        note: str(formData, 'note'),
        bankName: str(formData, 'bank_name'),
        bankBranchName: str(formData, 'bank_branch_name'),
        accountNo: str(formData, 'account_no'),
        chequeNo: str(formData, 'cheque_no'),
        lines,
      },
      user.id,
    );

    // `sendNotification($payroll, $payroll->staff->user->email, 'Salary Generate Reminder', ...)`
    const staff = await findStaff(staffId);
    if (staff) {
      await notifyPayroll({
        id: payrollId,
        staffUserId: staff.user.id,
        email: staff.user.email ?? null,
        phone: staff.staff.phone ?? null,
        netSalary: num(formData, 'basic_salary'),
        month: String(formData.get('payroll_month') ?? ''),
        year: String(formData.get('payroll_year') ?? ''),
      });
    }

    await successLog(`Payroll generated for staff ${staffId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['payroll.index']);
  redirect(ROUTES['payroll.index']);
}

/** `PayrollController@paymentPayroll` / `savePayrollPaymentData` - the "Pay Now" form. */
export async function payPayrollAction(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('payroll_payment_store');

  const id = num(formData, 'payroll_generate_id');
  if (!id) return { error: 'Something Went Wrong' };

  const paymentDate = str(formData, 'payment_date');
  if (!paymentDate) return { fieldErrors: { payment_date: 'Set the payment date.' } };

  const mode = str(formData, 'payment_mode');
  if (mode !== 'Cash' && mode !== 'Bank' && mode !== 'Cheque') {
    return { fieldErrors: { payment_mode: 'Choose a payment method.' } };
  }

  const input: PayrollPaymentInput = {
    paymentDate,
    paymentMode: mode,
    note: str(formData, 'note'),
  };

  if (mode === 'Bank') {
    input.bankName = str(formData, 'bank_name');
    input.bankBranchName = str(formData, 'bank_branch_name');
    input.accountNo = str(formData, 'account_no');
    if (!input.bankName || !input.bankBranchName || !input.accountNo) {
      return { error: 'Bank name, branch and account number are required for a bank payment.' };
    }
  } else if (mode === 'Cheque') {
    input.chequeNo = str(formData, 'cheque_no');
    if (!input.chequeNo) return { error: 'Cheque number is required for a cheque payment.' };
  }

  try {
    await payPayroll(id, input, user.id);
    await successLog(`Payroll ${id} paid`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['payroll.index']);
  return { success: 'Payment recorded.' };
}

export async function deletePayrollAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('payroll_payment_store');
  await deletePayroll(id);
  revalidatePath(ROUTES['payroll.index']);
}
