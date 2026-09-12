'use server';

// HR server actions - port of app/Http/Controllers/StaffController.php and
// Modules/RolePermission's RoleController / PermissionController.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { db } from '@/lib/db/client';
import { rolePermission, roles } from '@/lib/db/schema';
import { ROUTES } from '@/lib/routes';
import { fileFrom, saveAvatar, saveUpload } from '@/lib/uploads';
import {
  addStaffDocument,
  createStaff,
  deleteStaff,
  deleteStaffDocument,
  setStaffActive,
  updateStaff,
  type StaffInput,
} from '@/lib/hr/staff';
import { actionFormData } from '@/lib/forms';

export type HrFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function readStaffInput(formData: FormData): Promise<StaffInput> {
  return {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    username: str(formData, 'username'),
    roleRef: String(formData.get('role_id') ?? ''),
    password: str(formData, 'password'),
    avatar: await saveAvatar(fileFrom(formData, 'photo')),
    signature: await saveAvatar(fileFrom(formData, 'signature_photo'), 120, 60),

    departmentId: num(formData, 'department_id'),
    showroomId: num(formData, 'showroom_id'),
    warehouseId: num(formData, 'warehouse_id'),

    openingBalance: num(formData, 'opening_balance'),
    bankName: str(formData, 'bank_name'),
    bankBranchName: str(formData, 'bank_branch_name'),
    bankAccountName: str(formData, 'bank_account_name'),
    bankAccountNo: str(formData, 'bank_account_no'),
    basicSalary: str(formData, 'basic_salary'),
    employmentType: str(formData, 'employment_type'),
    provisionalMonths: num(formData, 'provisional_months'),
    dateOfJoining: str(formData, 'date_of_joining'),
    dateOfBirth: str(formData, 'date_of_birth'),
    leaveApplicableDate: str(formData, 'leave_applicable_date'),
    currentAddress: str(formData, 'current_address'),
    permanentAddress: str(formData, 'permanent_address'),
  };
}

/** `StaffRequest` - name, email and role are required; a new staff needs a password. */
function validate(
  input: StaffInput,
  isUpdate: boolean,
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.name) errors.name = 'The name field is required.';
  if (!input.email) errors.email = 'The email field is required.';
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
    errors.email = 'The email must be a valid email address.';
  }
  if (!input.roleRef) errors.role_id = 'Please select a role.';
  if (!isUpdate && !input.password) {
    errors.password = 'The password field is required.';
  } else if (input.password && input.password.length < 8) {
    errors.password = 'The password must be at least 8 characters.';
  }
  return Object.keys(errors).length ? errors : null;
}

export async function storeStaff(
  _prev: HrFormState,
  formData: FormData,
): Promise<HrFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('staffs.store');
  const input = await readStaffInput(formData);

  const fieldErrors = validate(input, false);
  if (fieldErrors) return { fieldErrors };

  try {
    await createStaff(input, user.id);
    await successLog(`Staff added: ${input.name}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['staffs.index']);
  redirect(ROUTES['staffs.index']);
}

export async function updateStaffAction(
  _prev: HrFormState,
  formData: FormData,
): Promise<HrFormState> {
  formData = actionFormData(_prev, formData);
  const id = Number(formData.get('id'));
  const user = await authorize('staffs.edit');
  const input = await readStaffInput(formData);

  const fieldErrors = validate(input, true);
  if (fieldErrors) return { fieldErrors };

  try {
    await updateStaff(id, input, user.id);
    await successLog(`Staff updated: ${input.name}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['staffs.index']);
  redirect(ROUTES['staffs.index']);
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('staffs.destroy');
  await deleteStaff(id);
  await successLog(`Staff deleted: ${id}`, user.id);
  revalidatePath(ROUTES['staffs.index']);
}

/** `StaffController@status_update` */
export async function toggleStaffActive(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const isActive = Number(formData.get('is_active'));
  const user = await authorize('staffs.update_active_status');

  await setStaffActive(id, isActive ? 0 : 1);
  await successLog(`Staff ${id} status changed`, user.id);
  revalidatePath(ROUTES['staffs.index']);
}

/** `StaffController@document_store` */
export async function uploadStaffDocument(
  _prev: HrFormState,
  formData: FormData,
): Promise<HrFormState> {
  formData = actionFormData(_prev, formData);
  const staffId = Number(formData.get('staff_id'));
  const user = await authorize('staffs.edit');

  const stored = await saveUpload(fileFrom(formData, 'document'), 'staff_document');
  if (!stored) return { error: 'Please choose a file.' };

  await addStaffDocument({
    staffId,
    name: str(formData, 'name'),
    document: stored,
    actorId: user.id,
  });

  revalidatePath(ROUTES['staffs.index']);
  return { success: 'Document uploaded.' };
}

export async function removeStaffDocument(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('staffs.edit');
  await deleteStaffDocument(id);
  revalidatePath(ROUTES['staffs.index']);
}

// --- Roles and permissions -------------------------------------------------

export async function saveRole(
  _prev: HrFormState,
  formData: FormData,
): Promise<HrFormState> {
  formData = actionFormData(_prev, formData);
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? 'regular_user');

  if (!name) return { fieldErrors: { name: 'The name field is required.' } };

  const user = await authorize(id ? 'permission.roles.edit' : 'permission.roles.store');

  try {
    if (id) {
      await db
        .update(roles)
        .set({ name, type, details: str(formData, 'details'), updatedAt: new Date() })
        .where(eq(roles.id, id));
      revalidatePath(ROUTES['permission.roles.index']);
      return { success: 'Role Updated Successfully' };
    }

    await db.insert(roles).values({
      name,
      type,
      details: str(formData, 'details'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath(ROUTES['permission.roles.index']);
    return { success: 'Role Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deleteRole(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('permission.roles.destroy');

  // The seeded roles (1-5) underpin the login rules; refuse to remove them.
  if (id <= 5) {
    await errorLog(`Role ${id} is a system role and was not deleted`, user.id);
    return;
  }

  await db.delete(rolePermission).where(eq(rolePermission.roleId, id));
  await db.delete(roles).where(eq(roles.id, id));
  await successLog(`Role deleted: ${id}`, user.id);
  revalidatePath(ROUTES['permission.roles.index']);
}

/**
 * `PermissionController@update` - replace a role's granted permissions with the
 * checked set.
 */
export async function saveRolePermissions(formData: FormData): Promise<void> {
  const roleId = Number(formData.get('role_id'));
  const user = await authorize('permission.permissions.edit');

  const permissionIds = formData
    .getAll('permission_id')
    .map((v) => Number(v))
    .filter(Number.isFinite);

  await db.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

  if (permissionIds.length) {
    await db.insert(rolePermission).values(
      permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
        status: 1,
        createdBy: user.id,
        updatedBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }

  await successLog(`Permissions updated for role ${roleId}`, user.id);
  revalidatePath(ROUTES['permission.permissions.index']);
  // Menus are permission-driven, so the whole shell needs re-rendering.
  revalidatePath('/', 'layout');
}

