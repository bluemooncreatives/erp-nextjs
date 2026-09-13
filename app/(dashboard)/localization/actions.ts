'use server';

// Localization actions - port of Modules/Localization LanguageController.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { db } from '@/lib/db/client';
import { languages } from '@/lib/db/schema';
import { ROUTES, route } from '@/lib/routes';
import { saveTranslations } from '@/lib/i18n';
import { actionFormData } from '@/lib/forms';

export type LanguageFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

/** `LanguageController@store` and `@update`. */
export async function saveLanguage(
  _prev: LanguageFormState,
  formData: FormData,
): Promise<LanguageFormState> {
  formData = actionFormData(_prev, formData);
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const user = await authorize(id ? 'languages.edit' : 'languages.store');

  const name = str(formData, 'name');
  const code = str(formData, 'code');
  const native = str(formData, 'native');

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'The name field is required.';
  if (!code) fieldErrors.code = 'The code field is required.';
  if (!native) fieldErrors.native = 'The native field is required.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    if (id) {
      await db
        .update(languages)
        .set({ name, code, native, updatedAt: new Date() })
        .where(eq(languages.id, id));
      await successLog('Language Updated Successfully', user.id);
      revalidatePath(ROUTES['languages.index']);
      return { success: 'Language Updated Successfully' };
    }

    await db.insert(languages).values({
      name,
      code,
      native,
      rtl: 0,
      status: 1,
      jsonExist: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await successLog('Language Added Successfully', user.id);
    revalidatePath(ROUTES['languages.index']);
    return { success: 'Language Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

/** `LanguageController@update_active_status` */
export async function toggleLanguageStatus(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const status = Number(formData.get('status'));
  await authorize('languages.update_active_status');

  await db
    .update(languages)
    .set({ status, updatedAt: new Date() })
    .where(eq(languages.id, id));

  revalidatePath(ROUTES['languages.index']);
  revalidatePath('/', 'layout');
}

/** `LanguageController@update_rtl_status` */
export async function toggleLanguageRtl(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const rtl = Number(formData.get('status'));
  await authorize();

  await db.update(languages).set({ rtl, updatedAt: new Date() }).where(eq(languages.id, id));

  revalidatePath(ROUTES['languages.index']);
  revalidatePath('/', 'layout');
}

/** `LanguageController@destroy` */
export async function deleteLanguage(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('languages.destroy');

  try {
    await db.delete(languages).where(eq(languages.id, id));
    await successLog('Language has been deleted Successfully', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['languages.index']);
}

// Switching the active language is `changeLocale` in `locale-actions.ts`,
// which is what the header's language select posts to.

/**
 * `LanguageController@key_value_store` - writes the locale's copy of one phrase
 * group. The PHP wrote a PHP array file; here the same group is a JSON file.
 */
export async function saveLanguagePhrases(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const group = str(formData, 'translatable_file_name');
  const user = await authorize();

  const [language] = await db.select().from(languages).where(eq(languages.id, id)).limit(1);
  if (!language || !group) return;

  const entries: Record<string, string> = {};
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith('key[')) continue;
    const key = field.slice(4, -1);
    entries[key] = String(value);
  }

  try {
    await saveTranslations(language.code, group, entries);
    await successLog(`${language.name}- translated.`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  redirect(
    `${route('language.translate_view', { id })}?file=${encodeURIComponent(group)}&saved=1`,
  );
}
