// ---------------------------------------------------------------------------
// Translations - port of Laravel's `__('file.key')` / `trans()` helpers and of
// the Localization module's file-backed phrase storage.
//
// The PHP app kept one PHP array per group under `resources/lang/{locale}/` and
// per module under `Modules/{Module}/Resources/lang/{locale}/`, with `default`
// holding the untranslated source strings. Those files were converted 1:1 into
// JSON under `lang/{locale}/`, module groups flattened to `module__group.json`
// (the PHP wrote them as `module::group`).
//
// The Localization screen reads and writes exactly these files, which is what
// `LanguageController@get_translate_file` and `@key_value_store` did.
// ---------------------------------------------------------------------------

import 'server-only';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import { getSession } from '@/lib/auth/session';
import { generalSetting } from '@/lib/settings';
import { db } from '@/lib/db/client';
import { languages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const LANG_ROOT = path.join(process.cwd(), 'lang');
export const DEFAULT_LOCALE = 'default';

export type Phrases = Record<string, unknown>;

/** `module::group` is how Laravel addressed a module file; on disk it is `module__group`. */
function fileNameOnDisk(group: string): string {
  return group.replace('::', '__');
}

/** The reverse - used when listing the files back for the translate screen. */
export function groupFromDiskName(name: string): string {
  return name.replace('__', '::');
}

async function readJson(locale: string, group: string): Promise<Phrases | null> {
  const file = path.join(LANG_ROOT, locale, `${fileNameOnDisk(group)}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Phrases;
  } catch {
    return null;
  }
}

/** `Lang::get($group)` for one locale, falling back to `default`. */
export const loadGroup = cache(
  async (locale: string, group: string): Promise<Phrases> => {
    const own = locale === DEFAULT_LOCALE ? null : await readJson(locale, group);
    const fallback = (await readJson(DEFAULT_LOCALE, group)) ?? {};
    return { ...fallback, ...(own ?? {}) };
  },
);

/** The locale in play - the session's `locale`, else the setting's language code. */
export const activeLocale = cache(async (): Promise<string> => {
  const session = await getSession();
  if (session?.locale) return session.locale;

  const setting = await generalSetting();
  if (setting.languageId) {
    const [lang] = await db
      .select({ code: languages.code })
      .from(languages)
      .where(eq(languages.id, setting.languageId))
      .limit(1);
    if (lang?.code) return lang.code;
  }
  return setting.languageName ?? 'en';
});

/**
 * `__('setting.Settings')` - splits on the first dot, reads the group and
 * returns the key itself when nothing is translated, exactly like Laravel.
 */
export async function trans(
  key: string,
  replace: Record<string, string | number> = {},
): Promise<string> {
  const locale = await activeLocale();
  return transIn(locale, key, replace);
}

export async function transIn(
  locale: string,
  key: string,
  replace: Record<string, string | number> = {},
): Promise<string> {
  const dot = key.indexOf('.');
  if (dot < 0) return applyReplacements(key, replace);

  const group = key.slice(0, dot);
  const item = key.slice(dot + 1);
  const phrases = await loadGroup(locale, group);

  const value = lookup(phrases, item);
  return applyReplacements(typeof value === 'string' ? value : item, replace);
}

/** Dotted lookup so nested groups (`validation.custom.x.y`) resolve. */
function lookup(phrases: Phrases, item: string): unknown {
  if (item in phrases) return phrases[item];
  let current: unknown = phrases;
  for (const part of item.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Laravel's `:attribute` placeholders. */
function applyReplacements(
  value: string,
  replace: Record<string, string | number>,
): string {
  let out = value;
  for (const [token, replacement] of Object.entries(replace)) {
    out = out.split(`:${token}`).join(String(replacement));
  }
  return out;
}

/** True when the active language is right-to-left - drives `dir="rtl"`. */
export async function isRtl(): Promise<boolean> {
  const locale = await activeLocale();
  const [lang] = await db
    .select({ rtl: languages.rtl })
    .from(languages)
    .where(eq(languages.code, locale))
    .limit(1);
  return lang?.rtl === 1;
}

/**
 * Every phrase of a locale, flattened to `group.key`, for handing to the
 * client.
 *
 * Server components can `await trans()`, but a client component cannot - so
 * the dashboard layout loads this once and puts it in context. It is about
 * 20KB gzipped for the whole application, and it travels in the shared
 * layout's payload rather than each page's.
 */
export const localeDictionary = cache(
  async (locale: string): Promise<Record<string, string>> => {
    const groups = await translatableGroups();
    const out: Record<string, string> = {};

    for (const group of groups) {
      const phrases = await loadGroup(locale, group);
      for (const [key, value] of Object.entries(phrases)) {
        if (typeof value === 'string') out[`${group}.${key}`] = value;
      }
    }

    return out;
  },
);

/** The `dir` and `lang` the document should carry for the active locale. */
export async function documentLocale(): Promise<{ lang: string; dir: 'ltr' | 'rtl' }> {
  const locale = await activeLocale();
  return { lang: locale === DEFAULT_LOCALE ? 'en' : locale, dir: (await isRtl()) ? 'rtl' : 'ltr' };
}

// --- the Localization screen ----------------------------------------------

/** `glob(resource_path('lang/default/*.php'))` - the translatable group names. */
export async function translatableGroups(): Promise<string[]> {
  const folder = path.join(LANG_ROOT, DEFAULT_LOCALE);
  if (!existsSync(folder)) return [];
  const entries = await readdir(folder);
  return entries
    .filter((f) => f.endsWith('.json'))
    .map((f) => groupFromDiskName(f.replace(/\.json$/, '')))
    .sort();
}

/**
 * `get_translate_file()` - the default phrases paired with whatever the locale
 * already has. Nested values are skipped: the PHP modal only edited flat keys.
 */
export async function translationPairs(
  locale: string,
  group: string,
): Promise<Array<{ key: string; source: string; value: string }>> {
  const [defaults, own] = await Promise.all([
    readJson(DEFAULT_LOCALE, group),
    readJson(locale, group),
  ]);

  const source = defaults ?? {};
  return Object.entries(source)
    .filter(([, v]) => typeof v === 'string')
    .map(([key, v]) => ({
      key,
      source: v as string,
      value:
        typeof own?.[key] === 'string' ? (own[key] as string) : (v as string),
    }));
}

/** `key_value_store()` - writes the locale's copy of one group. */
export async function saveTranslations(
  locale: string,
  group: string,
  entries: Record<string, string>,
): Promise<void> {
  const folder = path.join(LANG_ROOT, locale);
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, `${fileNameOnDisk(group)}.json`);
  await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}
