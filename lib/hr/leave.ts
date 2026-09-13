// ---------------------------------------------------------------------------
// Leave, attendance and payroll.
// Ports Modules/Leave, Modules/Attendance and Modules/Payroll.
//
// A leave application's `day` decides how the total is counted, exactly as
// `LeaveRepository::create()` did:
//   day 2  a date range  -> diffInDays + 1, less 0.5 when both ends are halves
//   day 1  a single day  -> 1
//   else   a half day    -> 0.5
// ---------------------------------------------------------------------------

import 'server-only';
import { PayrollLineKind, isEarningLine } from '@/lib/hr/payroll-lines';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  applyLeaves,
  applyLoans,
  attendances,
  departments,
  holidays,
  leaveDefines,
  leaveTypes,
  payrollEarnDeducs,
  payrolls,
  roles,
  staffs,
  users,
} from '@/lib/db/schema';
import { createReferenceRepository } from '@/lib/crud/reference-entity';
import { diffInDays, today, toDateString } from '@/lib/php-date';
import { MorphType } from '@/lib/db/morph';
import { findAccountByCode, findContactAccount } from '@/lib/accounting/accounts';
import { createJournalVoucher } from '@/lib/accounting/journal';
import { unpaidLoansForUser } from '@/lib/hr/loans';
import { VoucherType } from '@/lib/accounting/vouchers';
import { VoucherApproval, voucherAutoApproved } from '@/lib/business-settings';

/** `apply_leaves.status` - 0 pending, 1 approved, 2 rejected. */
export const LeaveStatus = { Pending: 0, Approved: 1, Rejected: 2 } as const;

/** `apply_leaves.day` - 1 single day, 2 range, otherwise half day. */
export const LeaveDayKind = { Half: 0, Single: 1, Range: 2 } as const;

export const leaveTypeRepository = createReferenceRepository<typeof leaveTypes.$inferSelect>({
  table: leaveTypes,
  id: leaveTypes.id,
  searchable: [leaveTypes.name],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

// ---------------------------------------------------------------------------
// Leave applications
// ---------------------------------------------------------------------------

export type LeaveInput = {
  userId: number;
  leaveTypeId: number;
  reason: string;
  applyDate: string;
  startDate: string;
  endDate?: string | null;
  day: number;
  /** Half-day markers for the first and last day of a range. */
  leaveFrom?: number;
  leaveTo?: number;
  makeupLeave?: number;
  makeupDate?: string | null;
  makeupHalf?: number;
  attachment?: string | null;
};

/** `LeaveRepository::create()` - the day-count rule. */
export function calculateLeaveDays(input: LeaveInput): number {
  if (input.day === LeaveDayKind.Range && input.endDate) {
    const total = diffInDays(input.startDate, input.endDate) + 1;
    // Both ends half days -> subtract one half.
    if (input.leaveFrom && input.leaveTo) return total - 0.5;
    return total;
  }
  return input.day === LeaveDayKind.Single ? 1 : 0.5;
}

export async function listLeaveApplications(filters: {
  userId?: number;
  status?: number;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [];
  if (filters.userId) where.push(eq(applyLeaves.userId, filters.userId));
  if (filters.status != null) where.push(eq(applyLeaves.status, filters.status));

  const condition = where.length ? and(...where) : undefined;

  const rows = await db
    .select({
      leave: applyLeaves,
      userName: users.name,
      userEmail: users.email,
      leaveTypeName: leaveTypes.name,
      approvedByName: sql<string | null>`(
        select u.name from users u where u.id = ${applyLeaves.approvedBy}
      )`,
    })
    .from(applyLeaves)
    .leftJoin(users, eq(users.id, applyLeaves.userId))
    .leftJoin(leaveTypes, eq(leaveTypes.id, applyLeaves.leaveTypeId))
    .where(condition)
    .orderBy(desc(applyLeaves.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applyLeaves)
    .where(condition);

  return { rows, total: Number(countRow?.count ?? 0), page, perPage };
}

/** `LeaveRepository::find($id)` with the names the leave application PDF shows. */
export async function findLeaveApplication(id: number) {
  const [row] = await db
    .select({
      leave: applyLeaves,
      userName: users.name,
      userEmail: users.email,
      leaveTypeName: leaveTypes.name,
      approvedByName: sql<string | null>`(
        select u.name from users u where u.id = ${applyLeaves.approvedBy}
      )`,
      createdByName: sql<string | null>`(
        select u.name from users u where u.id = ${applyLeaves.createdBy}
      )`,
    })
    .from(applyLeaves)
    .leftJoin(users, eq(users.id, applyLeaves.userId))
    .leftJoin(leaveTypes, eq(leaveTypes.id, applyLeaves.leaveTypeId))
    .where(eq(applyLeaves.id, id))
    .limit(1);
  return row ?? null;
}

export async function createLeaveApplication(
  input: LeaveInput,
  actorId: number,
): Promise<number> {
  const totalDays = calculateLeaveDays(input);

  const [row] = await db.insert(applyLeaves).values({
    userId: input.userId,
    leaveTypeId: input.leaveTypeId,
    reason: input.reason,
    attachment: input.attachment ?? null,
    applyDate: toDateString(input.applyDate) ?? today(),
    startDate: toDateString(input.startDate) ?? today(),
    endDate: input.day === LeaveDayKind.Range ? toDateString(input.endDate) : null,
    day: input.day,
    leaveFrom: input.leaveFrom ?? 0,
    leaveTo: input.leaveTo ?? 0,
    makeupLeave: input.makeupLeave ?? 0,
    makeupDate: input.makeupLeave ? toDateString(input.makeupDate) : null,
    makeupHalf: input.makeupHalf ?? 0,
    totalDays,
    status: LeaveStatus.Pending,
    createdBy: actorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return Number(row.insertId);
}

export async function updateLeaveApplication(
  id: number,
  input: LeaveInput,
  actorId: number,
): Promise<void> {
  const totalDays = calculateLeaveDays(input);

  await db
    .update(applyLeaves)
    .set({
      leaveTypeId: input.leaveTypeId,
      reason: input.reason,
      applyDate: toDateString(input.applyDate) ?? today(),
      startDate: toDateString(input.startDate) ?? today(),
      endDate: input.day === LeaveDayKind.Range ? toDateString(input.endDate) : null,
      day: input.day,
      leaveFrom: input.leaveFrom ?? 0,
      leaveTo: input.leaveTo ?? 0,
      makeupLeave: input.makeupLeave ?? 0,
      makeupDate: input.makeupLeave ? toDateString(input.makeupDate) : null,
      makeupHalf: input.makeupHalf ?? 0,
      totalDays,
      updatedBy: actorId,
      updatedAt: new Date(),
      ...(input.attachment ? { attachment: input.attachment } : {}),
    })
    .where(eq(applyLeaves.id, id));
}

/** `change_approval(['id' => .., 'status' => ..])` */
export async function setLeaveApproval(
  id: number,
  status: number,
  actorId: number,
): Promise<void> {
  await db
    .update(applyLeaves)
    .set({
      status,
      approvedBy: actorId,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(applyLeaves.id, id));
}

export async function deleteLeaveApplication(id: number): Promise<void> {
  await db.delete(applyLeaves).where(eq(applyLeaves.id, id));
}

/**
 * `totalLeave($id)` - the entitlement defined for the user's role less the
 * leave already approved.
 */
export async function leaveBalance(userId: number): Promise<{
  entitlement: number;
  taken: number;
  remaining: number;
}> {
  const [user] = await db
    .select({ roleId: users.roleId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { entitlement: 0, taken: 0, remaining: 0 };

  const [defined] = await db
    .select({ total: sql<number>`coalesce(sum(${leaveDefines.totalDays}), 0)` })
    .from(leaveDefines)
    .where(eq(leaveDefines.roleId, user.roleId));

  const [taken] = await db
    .select({ total: sql<number>`coalesce(sum(${applyLeaves.totalDays}), 0)` })
    .from(applyLeaves)
    .where(
      and(eq(applyLeaves.userId, userId), eq(applyLeaves.status, LeaveStatus.Approved)),
    );

  const entitlement = Number(defined?.total ?? 0);
  const used = Number(taken?.total ?? 0);
  return { entitlement, taken: used, remaining: entitlement - used };
}

/** `monthlyLeave($id, $month, $year)` - used by payroll. */
export async function monthlyLeaveDays(
  userId: number,
  month: number,
  year: number,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${applyLeaves.totalDays}), 0)` })
    .from(applyLeaves)
    .where(
      and(
        eq(applyLeaves.userId, userId),
        eq(applyLeaves.status, LeaveStatus.Approved),
        sql`month(${applyLeaves.startDate}) = ${month}`,
        sql`year(${applyLeaves.startDate}) = ${year}`,
      ),
    );
  return Number(row?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Leave definitions
// ---------------------------------------------------------------------------

export async function listLeaveDefines() {
  return db
    .select({
      define: leaveDefines,
      roleName: roles.name,
      leaveTypeName: leaveTypes.name,
    })
    .from(leaveDefines)
    .leftJoin(roles, eq(roles.id, leaveDefines.roleId))
    .leftJoin(leaveTypes, eq(leaveTypes.id, leaveDefines.leaveTypeId))
    .orderBy(desc(leaveDefines.id));
}

export async function saveLeaveDefine(
  data: {
    id?: number | null;
    roleId: number;
    leaveTypeId: number;
    totalDays: number;
    maxForward?: number;
    balanceForward?: number;
    year?: number | null;
  },
  actorId: number,
): Promise<void> {
  const values = {
    roleId: data.roleId,
    leaveTypeId: data.leaveTypeId,
    totalDays: data.totalDays,
    maxForward: data.maxForward ?? 0,
    balanceForward: data.balanceForward ?? 0,
    year: data.year ?? new Date().getUTCFullYear(),
    updatedBy: actorId,
    updatedAt: new Date(),
  };

  if (data.id) {
    await db.update(leaveDefines).set(values).where(eq(leaveDefines.id, data.id));
    return;
  }
  await db
    .insert(leaveDefines)
    .values({ ...values, createdBy: actorId, createdAt: new Date() });
}

export async function deleteLeaveDefine(id: number): Promise<void> {
  await db.delete(leaveDefines).where(eq(leaveDefines.id, id));
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/** `attendances.attendance` - the marks the PHP stored. */
export const AttendanceMark = {
  Present: 'P',
  Absent: 'A',
  Late: 'L',
  HalfDay: 'H',
  Holiday: 'F',
} as const;

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `AttendanceController@store` - upsert one mark per user per date. */
export async function saveAttendance(
  entries: Array<{ userId: number; roleId: number; mark: string; note?: string | null }>,
  date: string,
  actorId: number,
): Promise<void> {
  const d = new Date(`${date}T00:00:00Z`);
  const day = DAY_NAMES[d.getUTCDay()];
  const month = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();

  for (const entry of entries) {
    const [existing] = await db
      .select({ id: attendances.id })
      .from(attendances)
      .where(and(eq(attendances.userId, entry.userId), eq(attendances.date, date)))
      .limit(1);

    if (existing) {
      await db
        .update(attendances)
        .set({
          attendance: entry.mark,
          note: entry.note ?? null,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(attendances.id, existing.id));
      continue;
    }

    await db.insert(attendances).values({
      attendance: entry.mark,
      date,
      day,
      month,
      year,
      note: entry.note ?? null,
      userId: entry.userId,
      roleId: entry.roleId,
      createdBy: actorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function attendanceForDate(date: string, roleId?: number) {
  const where: SQL[] = [eq(attendances.date, date)];
  if (roleId) where.push(eq(attendances.roleId, roleId));

  return db
    .select({ attendance: attendances, userName: users.name })
    .from(attendances)
    .leftJoin(users, eq(users.id, attendances.userId))
    .where(and(...where));
}

/** `attendance_report.index` - one row per user, one column per day. */
export async function attendanceReport(month: number, year: number, roleId?: number) {
  const where: SQL[] = [
    sql`month(${attendances.date}) = ${month}`,
    sql`year(${attendances.date}) = ${year}`,
  ];
  if (roleId) where.push(eq(attendances.roleId, roleId));

  const rows = await db
    .select({
      userId: attendances.userId,
      userName: users.name,
      date: attendances.date,
      mark: attendances.attendance,
    })
    .from(attendances)
    .leftJoin(users, eq(users.id, attendances.userId))
    .where(and(...where))
    .orderBy(attendances.userId, attendances.date);

  const byUser = new Map<
    number,
    { userId: number; userName: string | null; marks: Record<string, string> }
  >();

  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? {
      userId: row.userId,
      userName: row.userName,
      marks: {},
    };
    if (row.date) entry.marks[row.date] = row.mark;
    byUser.set(row.userId, entry);
  }

  return [...byUser.values()];
}

/** `attendanceCheck($user_id, $type, $date)` from Helper.php. */
export async function attendanceCheck(
  userId: number,
  mark: string,
  date: string,
): Promise<boolean> {
  const [row] = await db
    .select({ attendance: attendances.attendance })
    .from(attendances)
    .where(and(eq(attendances.userId, userId), eq(attendances.date, date)))
    .limit(1);
  return row?.attendance === mark;
}

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

export async function listHolidays(year?: number) {
  return db
    .select()
    .from(holidays)
    .where(year ? eq(holidays.year, year) : undefined)
    .orderBy(desc(holidays.id));
}

export async function saveHoliday(data: {
  id?: number | null;
  name: string;
  /** 0 a single day, 1 a range stored as "from,to". */
  type: number;
  date: string;
  year: number;
}): Promise<void> {
  const values = {
    name: data.name,
    type: data.type,
    date: data.date,
    year: data.year,
    updatedAt: new Date(),
  };

  if (data.id) {
    await db.update(holidays).set(values).where(eq(holidays.id, data.id));
    return;
  }
  await db.insert(holidays).values({ ...values, createdAt: new Date() });
}

export async function deleteHoliday(id: number): Promise<void> {
  await db.delete(holidays).where(eq(holidays.id, id));
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export type PayrollLine = {
  typeName: string;
  amount: number;
  /** `PayrollLineKind.Earning` or `PayrollLineKind.Deduction`. */
  earnDedcType: string;
  /**
   * Set when this deduction repays a specific loan - `loanStatus[]` on the
   * Blade's auto-seeded rows. Meaningless on an earning line.
   */
  loanId?: number;
};

export async function listPayrolls(filters: {
  month?: string;
  year?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [];
  if (filters.month) where.push(eq(payrolls.payrollMonth, filters.month));
  if (filters.year) where.push(eq(payrolls.payrollYear, filters.year));

  const condition = where.length ? and(...where) : undefined;

  const rows = await db
    .select({
      payroll: payrolls,
      staffName: users.name,
      employeeId: staffs.employeeId,
      roleName: roles.name,
    })
    .from(payrolls)
    .leftJoin(staffs, eq(staffs.id, payrolls.staffId))
    .leftJoin(users, eq(users.id, staffs.userId))
    .leftJoin(roles, eq(roles.id, payrolls.roleId))
    .where(condition)
    .orderBy(desc(payrolls.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(payrolls)
    .where(condition);

  return { rows, total: Number(countRow?.count ?? 0), page, perPage };
}

/** `PayrollRepository::userPayrollDetails($staff_id)` - one staff member's slips. */
export async function staffPayrolls(staffId: number) {
  return db
    .select({
      payroll: payrolls,
      staffName: users.name,
      employeeId: staffs.employeeId,
      roleName: roles.name,
    })
    .from(payrolls)
    .leftJoin(staffs, eq(staffs.id, payrolls.staffId))
    .leftJoin(users, eq(users.id, staffs.userId))
    .leftJoin(roles, eq(roles.id, payrolls.roleId))
    .where(eq(payrolls.staffId, staffId))
    .orderBy(desc(payrolls.id));
}

export async function findPayroll(id: number) {
  const [row] = await db
    .select({
      payroll: payrolls,
      staffName: users.name,
      employeeId: staffs.employeeId,
      departmentName: departments.name,
      // `userName($payrollDetails->created_by)` on the payslip.
      preparedByName: sql<string | null>`(
        select u.name from users u where u.id = ${payrolls.createdBy}
      )`,
    })
    .from(payrolls)
    .leftJoin(staffs, eq(staffs.id, payrolls.staffId))
    .leftJoin(users, eq(users.id, staffs.userId))
    .leftJoin(departments, eq(departments.id, staffs.departmentId))
    .where(eq(payrolls.id, id))
    .limit(1);
  if (!row) return null;

  const lines = await db
    .select()
    .from(payrollEarnDeducs)
    .where(eq(payrollEarnDeducs.payrollId, id));

  return { ...row, lines };
}

/**
 * `PayrollRepository::create()` - the gross is basic + earnings, and the net is
 * gross less deductions and tax.
 */
export async function createPayroll(
  data: {
    staffId: number;
    roleId: number;
    basicSalary: number;
    tax?: number;
    payrollMonth: string;
    payrollYear: string;
    paymentMode?: string | null;
    paymentDate?: string | null;
    note?: string | null;
    bankName?: string | null;
    bankBranchName?: string | null;
    accountNo?: string | null;
    chequeNo?: string | null;
    lines: PayrollLine[];
  },
  actorId: number,
): Promise<number> {
  const totalEarning = data.lines
    .filter((line) => isEarningLine(line.earnDedcType))
    .reduce((sum, line) => sum + line.amount, 0);
  const totalDeduction = data.lines
    .filter((line) => !isEarningLine(line.earnDedcType))
    .reduce((sum, line) => sum + line.amount, 0);

  const grossSalary = data.basicSalary + totalEarning;
  const tax = data.tax ?? 0;
  const netSalary = grossSalary - totalDeduction - tax;

  return runInTransaction(async (conn) => {
    const [inserted] = await conn.insert(payrolls).values({
      staffId: data.staffId,
      roleId: data.roleId,
      basicSalary: data.basicSalary,
      totalEarning,
      totalDeduction,
      grossSalary,
      tax,
      netSalary,
      payrollMonth: data.payrollMonth,
      payrollYear: data.payrollYear,
      payrollStatus: 'Generated',
      paymentMode: data.paymentMode ?? null,
      paymentDate: toDateString(data.paymentDate),
      note: data.note ?? null,
      bankName: data.bankName ?? null,
      bankBranchName: data.bankBranchName ?? null,
      accountNo: data.accountNo ?? null,
      chequeNo: data.chequeNo ?? null,
      activeStatus: 1,
      createdBy: actorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const payrollId = Number(inserted.insertId);

    if (data.lines.length) {
      await conn.insert(payrollEarnDeducs).values(
        data.lines.map((line) => ({
          typeName: line.typeName,
          amount: line.amount,
          // Normalised, so a row written here reads the same as one Laravel wrote.
          earnDedcType: isEarningLine(line.earnDedcType)
            ? PayrollLineKind.Earning
            : PayrollLineKind.Deduction,
          loanStatus: line.loanId ? 1 : 0,
          payrollId,
          activeStatus: 1,
          createdBy: actorId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }

    // `PayrollRepository::create()` - a deduction line tagged with a loan
    // retires that much of it, and marks the loan fully paid once it reaches
    // the original amount.
    for (const line of data.lines) {
      if (!line.loanId || isEarningLine(line.earnDedcType)) continue;

      const [loan] = await conn
        .select({ amount: applyLoans.amount, paidLoanAmount: applyLoans.paidLoanAmount })
        .from(applyLoans)
        .where(eq(applyLoans.id, line.loanId))
        .limit(1);
      if (!loan || Number(loan.amount) <= Number(loan.paidLoanAmount)) continue;

      const paidLoanAmount = Number(loan.paidLoanAmount) + line.amount;
      await conn
        .update(applyLoans)
        .set({
          paidLoanAmount,
          paid: paidLoanAmount >= Number(loan.amount) ? 1 : 0,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(applyLoans.id, line.loanId));
    }

    return payrollId;
  });
}

// The two accounts every payroll payment touches - both installer-seeded, so
// a missing one means the chart of accounts was edited, not that this is
// reachable in the ordinary case.
const SALARY_ALLOWANCE_CODE = '03-18';
const CASH_ACCOUNT_CODE = '01-01-02';

export type PayrollPaymentInput = {
  paymentDate: string;
  paymentMode: 'Cash' | 'Bank' | 'Cheque';
  note?: string | null;
  bankName?: string | null;
  bankBranchName?: string | null;
  accountNo?: string | null;
  chequeNo?: string | null;
};

/**
 * `PayrollController@savePayrollPaymentData` ->
 * `PayrollRepository::savePayrollPaymentData()`.
 *
 * Records how the payroll was paid and posts the journal voucher the PHP
 * posted alongside it: Salary & Allowance is debited for the basic pay
 * (adjusted by every non-loan earning/deduction line) and Cash is credited
 * for the net amount actually paid out. A deduction line flagged
 * `loan_status` does not touch Cash at all - it credits the staff's own
 * chart account instead, the same account `changeLoanApproval` debited when
 * the loan was paid out, so the salary retires part of that loan rather than
 * paying cash for it twice. A payroll with no earning/deduction lines posts
 * the simpler two-leg voucher the PHP falls back to.
 */
export async function payPayroll(
  id: number,
  data: PayrollPaymentInput,
  actorId: number,
): Promise<void> {
  const [row] = await db
    .select({ payroll: payrolls, userId: staffs.userId })
    .from(payrolls)
    .leftJoin(staffs, eq(staffs.id, payrolls.staffId))
    .where(eq(payrolls.id, id))
    .limit(1);
  if (!row) return;

  const lines = await db
    .select()
    .from(payrollEarnDeducs)
    .where(eq(payrollEarnDeducs.payrollId, id));

  await db
    .update(payrolls)
    .set({
      paymentDate: toDateString(data.paymentDate),
      paymentMode: data.paymentMode,
      note: data.note ?? null,
      bankName: data.paymentMode === 'Bank' ? (data.bankName ?? null) : null,
      bankBranchName:
        data.paymentMode === 'Bank' ? (data.bankBranchName ?? null) : null,
      accountNo: data.paymentMode === 'Bank' ? (data.accountNo ?? null) : null,
      chequeNo: data.paymentMode === 'Cheque' ? (data.chequeNo ?? null) : null,
      payrollStatus: 'Paid',
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(payrolls.id, id));

  const salaryAccount = await findAccountByCode(SALARY_ALLOWANCE_CODE);
  const cashAccount = await findAccountByCode(CASH_ACCOUNT_CODE);
  if (!salaryAccount || !cashAccount) return;

  const isApprove = (await voucherAutoApproved(VoucherApproval.Payroll)) ? 1 : 0;
  const basicSalary = Number(row.payroll.basicSalary ?? 0);
  const netSalary = Number(row.payroll.netSalary ?? 0);

  if (lines.length > 0) {
    let mainAmount = basicSalary;
    const subAccountId: number[] = [cashAccount.id];
    const subAmount: number[] = [netSalary];
    const subNarration: Array<string | null> = ['Salary Pay'];

    for (const line of lines) {
      const amount = Number(line.amount ?? 0);
      const isDeduction = !isEarningLine(line.earnDedcType);
      if (line.loanStatus === 1 && isDeduction) {
        const staffAccount = row.userId
          ? await findContactAccount(row.userId, MorphType.User)
          : null;
        if (staffAccount) {
          subAccountId.push(staffAccount.id);
          subAmount.push(amount);
          subNarration.push(line.typeName);
        }
      } else if (isDeduction) {
        mainAmount -= amount;
      } else {
        mainAmount += amount;
      }
    }

    await createJournalVoucher({
      voucherType: VoucherType.Journal,
      amount: mainAmount,
      date: today(),
      accountType: 'debit',
      paymentType: 'journal_voucher',
      accountId: salaryAccount.id,
      mainAmount,
      narration: 'Staff Salary',
      subAccountId,
      subAmount,
      subNarration,
      isApprove,
      createdBy: actorId,
    });
  } else {
    await createJournalVoucher({
      voucherType: VoucherType.Journal,
      amount: basicSalary,
      date: today(),
      accountType: 'credit',
      paymentType: 'journal_voucher',
      accountId: cashAccount.id,
      mainAmount: basicSalary,
      narration: 'Staff Salary',
      subAccountId: [salaryAccount.id],
      subAmount: [netSalary],
      subNarration: ['Salary Pay'],
      isApprove,
      createdBy: actorId,
    });
  }
}

export async function deletePayroll(id: number): Promise<void> {
  await db.delete(payrollEarnDeducs).where(eq(payrollEarnDeducs.payrollId, id));
  await db.delete(payrolls).where(eq(payrolls.id, id));
}

/**
 * Staff who can be paid, for the payroll form - each with the loans
 * `PayrollController@generatePayroll` offered as ready-made deduction lines.
 */
export async function payableStaff(roleId?: number | null) {
  const rows = await db
    .select({
      id: staffs.id,
      userId: staffs.userId,
      name: users.name,
      employeeId: staffs.employeeId,
      basicSalary: staffs.basicSalary,
      roleId: users.roleId,
      bankName: staffs.bankName,
      bankBranchName: staffs.bankBranchName,
      accountNo: staffs.bankAccountNo,
    })
    .from(staffs)
    .innerJoin(users, eq(users.id, staffs.userId))
    // `staff_search_for_payroll` narrowed the list to one role.
    .where(roleId ? and(eq(users.isActive, 1), eq(users.roleId, roleId)) : eq(users.isActive, 1))
    .orderBy(users.name);

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      loans: row.userId ? await unpaidLoansForUser(row.userId) : [],
    })),
  );
}

export { PayrollLineKind, isEarningLine };
