// ---------------------------------------------------------------------------
// Staff - port of app/Repositories/UserRepository.php and StaffController.
//
// Creating a staff member writes three things:
//   1. a `users` login (the role is posted as "<role_id>-<role_type>")
//   2. a `staffs` record with the employment and bank details
//   3. for non-system users, a ChartAccount under parent 9 (staff payable),
//      plus the opening-balance entries when a balance was entered
//
// `Staff::boot()` stamps the employee id as `<IntroPrefix 8>-3<5-digit id>`.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  chartAccounts,
  departments,
  roles,
  showRooms,
  staffDocuments,
  staffs,
  users,
  wareHouses,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { hashPassword } from '@/lib/auth/password';
import { deleteStoredFile } from '@/lib/uploads';
import { IntroPrefixId, introPrefixFor } from '@/lib/settings';
import { AccountType, ConfigurationGroup } from '@/lib/accounting/accounts';
import {
  createOpeningBalanceForContact,
  createOpeningBalanceHistory,
} from '@/lib/accounting/opening-balance';
import { today, toDateString } from '@/lib/php-date';

/** Chart-of-accounts parent for staff balances, per the installer seed. */
const STAFF_PARENT_ACCOUNT_ID = 9;

/** The control account staff opening balances offset against. */
const STAFF_OPENING_CONTROL_CODE = '02-09';

export type StaffInput = {
  name: string;
  email: string;
  username?: string | null;
  /** Posted as `"<role_id>-<role_type>"`, as the Blade select did. */
  roleRef: string;
  password?: string | null;
  avatar?: string | null;
  signature?: string | null;

  /** The staff row's own phone; the forms posted the username into it. */
  phone?: string | null;

  departmentId?: number | null;
  showroomId?: number | null;
  warehouseId?: number | null;

  openingBalance?: number | null;
  bankName?: string | null;
  bankBranchName?: string | null;
  bankAccountName?: string | null;
  bankAccountNo?: string | null;
  basicSalary?: string | null;
  employmentType?: string | null;
  provisionalMonths?: number | null;
  dateOfJoining?: string | null;
  dateOfBirth?: string | null;
  leaveApplicableDate?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
};

function parseRoleRef(ref: string): { roleId: number; roleType: string } {
  const [rawId, roleType] = String(ref).split('-');
  return { roleId: Number(rawId) || 0, roleType: roleType ?? 'regular_user' };
}

export async function listStaff(filters: {
  search?: string;
  departmentId?: number;
  showroomId?: number;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [];
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      or(
        like(users.name, term),
        like(users.email, term),
        like(staffs.employeeId, term),
        like(staffs.phone, term),
      )!,
    );
  }
  if (filters.departmentId) where.push(eq(staffs.departmentId, filters.departmentId));
  if (filters.showroomId) where.push(eq(staffs.showroomId, filters.showroomId));

  const condition = where.length ? and(...where) : undefined;

  const rows = await db
    .select({
      staff: staffs,
      user: users,
      roleName: roles.name,
      departmentName: departments.name,
      showroomName: showRooms.name,
      warehouseName: wareHouses.name,
    })
    .from(staffs)
    .innerJoin(users, eq(users.id, staffs.userId))
    .leftJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(departments, eq(departments.id, staffs.departmentId))
    .leftJoin(showRooms, eq(showRooms.id, staffs.showroomId))
    .leftJoin(wareHouses, eq(wareHouses.id, staffs.warehouseId))
    .where(condition)
    .orderBy(desc(staffs.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(staffs)
    .innerJoin(users, eq(users.id, staffs.userId))
    .where(condition);

  return { rows, total: Number(countRow?.count ?? 0), page, perPage };
}

export async function findStaff(id: number) {
  const [row] = await db
    .select({
      staff: staffs,
      user: users,
      roleName: roles.name,
      roleType: roles.type,
      departmentName: departments.name,
      showroomName: showRooms.name,
      warehouseName: wareHouses.name,
    })
    .from(staffs)
    .innerJoin(users, eq(users.id, staffs.userId))
    .leftJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(departments, eq(departments.id, staffs.departmentId))
    .leftJoin(showRooms, eq(showRooms.id, staffs.showroomId))
    .leftJoin(wareHouses, eq(wareHouses.id, staffs.warehouseId))
    .where(eq(staffs.id, id))
    .limit(1);

  if (!row) return null;

  const docs = await db
    .select()
    .from(staffDocuments)
    .where(eq(staffDocuments.staffId, id))
    .orderBy(desc(staffDocuments.id));

  return { ...row, documents: docs };
}

/** `UserRepository::store($data)` */
export async function createStaff(
  data: StaffInput,
  actorId?: number | null,
): Promise<number> {
  const { roleId, roleType } = parseRoleRef(data.roleRef);
  const isSystemUser = roleType === 'system_user';

  const [controlAccount] = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(eq(chartAccounts.code, STAFF_OPENING_CONTROL_CODE))
    .limit(1);

  return runInTransaction(async (tx) => {
    const [userRow] = await tx.insert(users).values({
      name: data.name,
      email: data.email,
      username: data.username ?? null,
      roleId,
      avatar: data.avatar ?? null,
      signature: data.signature ?? null,
      password: await hashPassword(data.password ?? crypto.randomUUID()),
      isActive: 1,
      notificationPreference: 'mail',
      // The PHP verified immediately unless email verification was switched on.
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const userId = Number(userRow.insertId);

    const staffValues: Record<string, unknown> = {
      userId,
      departmentId: data.departmentId ?? null,
      showroomId: data.showroomId ?? null,
      warehouseId: data.warehouseId ?? null,
      phone: data.phone ?? data.username ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Employment and bank details are only kept for non-system users.
    if (!isSystemUser) {
      Object.assign(staffValues, {
        openingBalance: data.openingBalance ?? 0,
        bankName: data.bankName ?? null,
        bankBranchName: data.bankBranchName ?? null,
        bankAccountName: data.bankAccountName ?? null,
        bankAccountNo: data.bankAccountNo ?? null,
        basicSalary: data.basicSalary ?? '0',
        employmentType: data.employmentType ?? 'Permanent',
        provisionalMonths: data.provisionalMonths ?? 0,
        dateOfJoining: toDateString(data.dateOfJoining) ?? today(),
        dateOfBirth: toDateString(data.dateOfBirth),
        leaveApplicableDate: toDateString(data.leaveApplicableDate),
        currentAddress: data.currentAddress ?? null,
        permanentAddress: data.permanentAddress ?? null,
      });
    }

    const [staffRow] = await tx.insert(staffs).values(staffValues as never);
    const staffId = Number(staffRow.insertId);

    // `Staff::boot()` - EMP-3xxxxx
    const prefix = await introPrefixFor(IntroPrefixId.Staff);
    await tx
      .update(staffs)
      .set({
        employeeId: prefix
          ? `${prefix}-3${String(staffId).padStart(5, '0')}`
          : `EMP-${String(staffId).padStart(5, '0')}`,
      })
      .where(eq(staffs.id, staffId));

    if (!isSystemUser) {
      const [accountRow] = await tx.insert(chartAccounts).values({
        level: 2,
        isGroup: 0,
        name: data.name,
        description: null,
        parentId: STAFF_PARENT_ACCOUNT_ID,
        status: 1,
        configurationGroupId: ConfigurationGroup.Payable,
        type: String(AccountType.Asset),
        contactableType: MorphType.User,
        contactableId: userId,
        createdBy: actorId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const accountId = Number(accountRow.insertId);
      // The PHP did NOT zero-pad the parent here (unlike the contact code).
      await tx
        .update(chartAccounts)
        .set({
          code: `0${AccountType.Asset}-${STAFF_PARENT_ACCOUNT_ID}-${accountId}`,
        })
        .where(eq(chartAccounts.id, accountId));

      const opening = Number(data.openingBalance ?? 0);
      if (opening > 0) {
        await createOpeningBalanceForContact(
          {
            assetAccountId: accountId,
            assetAmount: opening,
            liabilityAccountId: controlAccount?.id ?? null,
            liabilityAmount: opening,
            date: today(),
          },
          tx,
        );
        await createOpeningBalanceHistory(
          { accountId, type: 'staff', amount: opening },
          tx,
        );
      }
    }

    return staffId;
  });
}

/** `UserRepository::update($data, $id)` - `$id` is the USER id in the PHP. */
export async function updateStaff(
  staffId: number,
  data: StaffInput,
  actorId?: number | null,
): Promise<void> {
  const found = await findStaff(staffId);
  if (!found) return;

  const { roleId, roleType } = parseRoleRef(data.roleRef);
  const isSystemUser = roleType === 'system_user';

  // Replacing an image removes the old file.
  if (data.avatar && found.user.avatar) await deleteStoredFile(found.user.avatar);
  if (data.signature && found.user.signature) {
    await deleteStoredFile(found.user.signature);
  }

  await runInTransaction(async (tx) => {
    const userValues: Record<string, unknown> = {
      name: data.name,
      username: data.username ?? null,
      roleId,
      updatedAt: new Date(),
    };
    if (data.avatar) userValues.avatar = data.avatar;
    if (data.signature) userValues.signature = data.signature;
    if (data.password) userValues.password = await hashPassword(data.password);

    await tx.update(users).set(userValues).where(eq(users.id, found.user.id));

    const staffValues: Record<string, unknown> = {
      departmentId: data.departmentId ?? null,
      showroomId: data.showroomId ?? null,
      warehouseId: data.warehouseId ?? null,
      phone: data.phone ?? data.username ?? null,
      updatedAt: new Date(),
    };

    if (!isSystemUser) {
      Object.assign(staffValues, {
        openingBalance: data.openingBalance ?? 0,
        bankName: data.bankName ?? null,
        bankBranchName: data.bankBranchName ?? null,
        bankAccountName: data.bankAccountName ?? null,
        bankAccountNo: data.bankAccountNo ?? null,
        basicSalary: data.basicSalary ?? '0',
        employmentType: data.employmentType ?? 'Permanent',
        provisionalMonths: data.provisionalMonths ?? 0,
        dateOfJoining: toDateString(data.dateOfJoining),
        dateOfBirth: toDateString(data.dateOfBirth),
        leaveApplicableDate: toDateString(data.leaveApplicableDate),
        currentAddress: data.currentAddress ?? null,
        permanentAddress: data.permanentAddress ?? null,
      });
    }

    await tx.update(staffs).set(staffValues).where(eq(staffs.id, staffId));

    // Keep the ledger account's name aligned.
    await tx
      .update(chartAccounts)
      .set({ name: data.name, updatedBy: actorId ?? null, updatedAt: new Date() })
      .where(
        and(
          eq(chartAccounts.contactableType, MorphType.User),
          eq(chartAccounts.contactableId, found.user.id),
        ),
      );
  });
}

/** `StaffController@destroy` */
export async function deleteStaff(staffId: number): Promise<void> {
  const found = await findStaff(staffId);
  if (!found) return;

  await runInTransaction(async (tx) => {
    await tx.delete(staffDocuments).where(eq(staffDocuments.staffId, staffId));
    await tx.delete(staffs).where(eq(staffs.id, staffId));
    await tx.delete(users).where(eq(users.id, found.user.id));
  });

  await deleteStoredFile(found.user.avatar);
  await deleteStoredFile(found.user.signature);
}

/** `StaffController@status_update` - toggles the login's active flag. */
export async function setStaffActive(
  staffId: number,
  isActive: number,
): Promise<void> {
  const found = await findStaff(staffId);
  if (!found) return;
  await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, found.user.id));
}

/** `StaffController@document_store` */
export async function addStaffDocument(data: {
  staffId: number;
  name?: string | null;
  /** Stored path - the column is `documents` in this schema. */
  document: string;
  actorId?: number | null;
}): Promise<void> {
  await db.insert(staffDocuments).values({
    staffId: data.staffId,
    name: data.name ?? null,
    documents: data.document,
    createdBy: data.actorId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function deleteStaffDocument(id: number): Promise<void> {
  const [doc] = await db
    .select()
    .from(staffDocuments)
    .where(eq(staffDocuments.id, id))
    .limit(1);
  if (!doc) return;

  await db.delete(staffDocuments).where(eq(staffDocuments.id, id));
  await deleteStoredFile(doc.documents);
}

/** Role options for the staff form, formatted as the `"<id>-<type>"` the PHP used. */
export async function roleOptions() {
  const rows = await db.select().from(roles).orderBy(roles.id);
  return rows.map((r) => ({ value: `${r.id}-${r.type}`, label: r.name, id: r.id }));
}

/** `Role::where('type', 'regular_user')->get()` - the payroll screen's roles. */
export async function regularUserRoles() {
  return db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.type, 'regular_user'))
    .orderBy(roles.id);
}

/** Active users, for the "apply on behalf of" select the Blade showed admins. */
export async function activeUserOptions() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isActive, 1))
    .orderBy(users.name);
}
