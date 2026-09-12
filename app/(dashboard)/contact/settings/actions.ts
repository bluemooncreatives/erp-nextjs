'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { generalSettings } from '@/lib/db/schema';
import { successLog } from '@/lib/activity-log';

export async function saveContactSettings(form: FormData) {
  const user = await authorize('contact.settings');
  await db.update(generalSettings).set({ contactLogin: form.get('contact_login') === '1' ? 1 : 0, updatedAt: new Date() }).where(eq(generalSettings.id, 1));
  await successLog('Contact Settings updated Successfully', user.id);
  revalidatePath('/contact/settings');
}
