'use server';

// Port of Modules/Localization LanguageController@change - the header's
// language selector, which stored the chosen code in the session.

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { languages } from '@/lib/db/schema';
import { patchSession } from '@/lib/auth/session';

export async function changeLocale(code: string): Promise<void> {
  const [lang] = await db
    .select({ code: languages.code })
    .from(languages)
    .where(and(eq(languages.code, code), eq(languages.status, 1)))
    .limit(1);
  if (!lang) return;
  await patchSession({ locale: lang.code ?? 'en' });
}
