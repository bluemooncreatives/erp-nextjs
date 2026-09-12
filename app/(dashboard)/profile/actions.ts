'use server';

// Contact profile - port of ContactController@post_profile and
// ContactRepository::updateProfile().

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { db } from '@/lib/db/client';
import { contacts, users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { saveAvatar, fileFrom, deleteStoredFile } from '@/lib/uploads';
import { ROUTES } from '@/lib/routes';

export type ContactProfileState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function updateContactProfile(
  _prev: ContactProfileState,
  formData: FormData,
): Promise<ContactProfileState> {
  const user = await requireUser();
  const contactId = Number(user.contactId);
  if (!contactId) return { error: 'Something Went Wrong' };

  const name = str(formData, 'name');
  const password = str(formData, 'password');
  const confirmation = str(formData, 'password_confirmation');

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'The name field is required.';
  if (password && password !== confirmation) {
    fieldErrors.password = 'The password confirmation does not match.';
  }
  if (password && !confirmation) {
    fieldErrors.password_confirmation = 'The password confirmation field is required.';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
    if (!contact) return { error: 'Something Went Wrong' };

    const values: Record<string, unknown> = {
      name,
      email: str(formData, 'email') || null,
      taxNumber: str(formData, 'tax_number') || null,
      countryId: Number(formData.get('country_id')) || null,
      state: str(formData, 'state') || null,
      city: str(formData, 'city') || null,
      address: str(formData, 'address') || null,
      note: str(formData, 'note') || null,
      mobile: str(formData, 'mobile') || null,
      updatedAt: new Date(),
    };

    // The repository deleted the previous avatar before storing the new one.
    const file = fileFrom(formData, 'file');
    let avatar: string | null = null;
    if (file) {
      await deleteStoredFile(contact.avatar);
      avatar = await saveAvatar(file);
      if (avatar) values.avatar = avatar;
    }

    await db.update(contacts).set(values).where(eq(contacts.id, contactId));

    // The contact's login is kept in step, exactly as `updateProfile()` did.
    const linkedUserId = Number(contact.userId);
    if (linkedUserId) {
      const userValues: Record<string, unknown> = {
        name,
        email: str(formData, 'email') || null,
        updatedAt: new Date(),
      };
      if (avatar) {
        userValues.avatar = avatar;
        userValues.photo = avatar;
      }
      if (password) userValues.password = await hashPassword(password);

      await db.update(users).set(userValues).where(eq(users.id, linkedUserId));
    }

    await successLog('Contact profile Updated Successfully', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['contact.profile']);
  revalidatePath('/', 'layout');
  return { success: 'Contact Updated Successfully' };
}
