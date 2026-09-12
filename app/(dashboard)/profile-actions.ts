'use server';

// Profile and password actions - ports of StaffController@profile_update and
// HomeController@post_change_password.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, ne } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { db } from '@/lib/db/client';
import { staffs, users } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { saveAvatar, fileFrom } from '@/lib/uploads';
import { ROUTES } from '@/lib/routes';
import { actionFormData } from '@/lib/forms';

export type ProfileFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

/** `StaffController@profile_update` + `UserRepository::updateProfile`. */
export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  formData = actionFormData(_prev, formData);
  const actor = await requireUser();

  const name = str(formData, 'name');
  const email = str(formData, 'email');
  const phone = str(formData, 'phone');
  const password = str(formData, 'password');
  const passwordConfirmation = str(formData, 'password_confirmation');

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'The name field is required.';
  if (!email) fieldErrors.email = 'The email field is required.';
  if (password && password !== passwordConfirmation) {
    fieldErrors.password = 'The password confirmation does not match.';
  }
  if (password && !passwordConfirmation) {
    fieldErrors.password_confirmation = 'The password confirmation field is required.';
  }

  // `unique:users,email,<id>`
  if (email) {
    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, actor.id)))
      .limit(1);
    if (clash) fieldErrors.email = 'The email has already been taken.';
  }

  const [staff] = await db
    .select()
    .from(staffs)
    .where(eq(staffs.userId, actor.id))
    .limit(1);

  // `unique:staffs,phone,<staff id>`
  if (phone && staff) {
    const [clash] = await db
      .select({ id: staffs.id })
      .from(staffs)
      .where(and(eq(staffs.phone, phone), ne(staffs.id, staff.id)))
      .limit(1);
    if (clash) fieldErrors.phone = 'The phone has already been taken.';
  }

  // Everyone but the super admin (role 1) had to supply bank and address details.
  const isSuperAdmin = actor.roleId === 1;
  const bankFields = {
    bank_name: str(formData, 'bank_name'),
    bank_branch_name: str(formData, 'bank_branch_name'),
    bank_account_name: str(formData, 'bank_account_name'),
    bank_account_no: str(formData, 'bank_account_no'),
    current_address: str(formData, 'current_address'),
    permanent_address: str(formData, 'permanent_address'),
  };
  if (!isSuperAdmin) {
    for (const [field, value] of Object.entries(bankFields)) {
      if (!value) fieldErrors[field] = `The ${field.replace(/_/g, ' ')} field is required.`;
    }
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const userValues: Record<string, unknown> = { name, email, updatedAt: new Date() };

    const avatar = await saveAvatar(fileFrom(formData, 'avatar'), 60, 60);
    if (avatar) userValues.avatar = avatar;
    if (password) userValues.password = await hashPassword(password);

    await db.update(users).set(userValues).where(eq(users.id, actor.id));

    if (staff) {
      const staffValues: Record<string, unknown> = { phone, updatedAt: new Date() };
      if (!isSuperAdmin) {
        Object.assign(staffValues, {
          bankName: bankFields.bank_name,
          bankBranchName: bankFields.bank_branch_name,
          bankAccountName: bankFields.bank_account_name,
          bankAccountNo: bankFields.bank_account_no,
          currentAddress: bankFields.current_address,
          permanentAddress: bankFields.permanent_address,
        });
      }
      await db.update(staffs).set(staffValues).where(eq(staffs.id, staff.id));
    }

    await successLog('Profile has been updated.', actor.id);
  } catch (error) {
    await errorLog(String(error), actor.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath('/', 'layout');
  return { success: 'Staff info has been updated Successfully' };
}

/** `HomeController@post_change_password` */
export async function changePassword(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  formData = actionFormData(_prev, formData);
  const actor = await requireUser();

  const currentPassword = str(formData, 'current_password');
  const password = str(formData, 'password');
  const confirmation = str(formData, 'password_confirmation');

  const fieldErrors: Record<string, string> = {};
  if (!currentPassword) fieldErrors.current_password = 'The current password field is required.';
  if (!password) fieldErrors.password = 'The password field is required.';
  else if (password.length < 8)
    fieldErrors.password = 'The password must be at least 8 characters.';
  else if (password !== confirmation)
    fieldErrors.password = 'The password confirmation does not match.';

  if (!Object.keys(fieldErrors).length) {
    const [row] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, actor.id))
      .limit(1);

    if (!row || !(await verifyPassword(currentPassword, row.password))) {
      // The PHP added this under `current_password` with the `auth.failed` text.
      fieldErrors.current_password = 'These credentials do not match our records.';
    }
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await db
    .update(users)
    .set({ password: await hashPassword(password), updatedAt: new Date() })
    .where(eq(users.id, actor.id));

  await successLog('Password change successful', actor.id);
  redirect(ROUTES['home']);
}
