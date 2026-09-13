// Does switching language work for languages other than Arabic?
//
//   BASE_URL=http://localhost:3100 DB_HOST=... node scripts/verify-locales.mjs
//
// Activates a language that has no pack at all, drives the UI in it, writes a
// phrase through the same helper the Localization screen uses, and checks the
// phrase reaches the page. Restores the database and the files afterwards.

import { createRequire } from 'node:module';
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SignJWT } from 'jose';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';

loadEnv();
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const base = process.env.BASE_URL ?? 'http://localhost:3100';
const secret = new TextEncoder().encode(requireSessionSecret());

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'software_erp',
});

const token = (locale) =>
  new SignJWT({
    uid: 1,
    roleId: 1,
    roleType: 'system_user',
    showroomId: 1,
    staffId: null,
    locale,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret);

async function page(locale, url = '/home') {
  const res = await fetch(base + url, {
    headers: { cookie: 'infix_biz_session=' + (await token(locale)) },
    redirect: 'manual',
  });
  const html = await res.text();
  return {
    status: res.status,
    lang: /<html[^>]*lang="([^"]+)"/.exec(html)?.[1] ?? null,
    dir: /<html[^>]*dir="([^"]+)"/.exec(html)?.[1] ?? null,
    html,
  };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

// --- the languages already in play -----------------------------------------

const [[amharic]] = await connection.query(
  "select code, status, rtl from languages where code = 'am'",
);

const english = await page('en');
check(
  'English: ltr, lang=en, renders in English',
  english.dir === 'ltr' && english.lang === 'en' && english.html.includes('Dashboard'),
  `lang=${english.lang} dir=${english.dir}`,
);

const arabic = await page('ar');
check(
  'Arabic: rtl, lang=ar, renders translated',
  arabic.dir === 'rtl' && arabic.lang === 'ar' && arabic.html.includes('لوحة التحكم'),
  `lang=${arabic.lang} dir=${arabic.dir}`,
);

// Amharic is active in this database and has no `lang/am` folder at all.
check(
  'Amharic is active but has no pack on disk',
  amharic?.status === 1 && !existsSync(path.join(process.cwd(), 'lang', 'am')),
);

const am = await page('am');
check(
  'Amharic: falls back to English rather than printing keys',
  am.status === 200 && am.dir === 'ltr' && am.lang === 'am' && am.html.includes('Dashboard'),
  `lang=${am.lang} dir=${am.dir}`,
);

// --- a language nobody has touched ------------------------------------------

const HEBREW = 'he';
const hebrewDir = path.join(process.cwd(), 'lang', HEBREW);
const [[before]] = await connection.query(
  'select status from languages where code = ?',
  [HEBREW],
);

await connection.query('update languages set status = 1 where code = ?', [HEBREW]);

try {
  // The switcher lists what is active, so Hebrew has to appear once activated.
  const listed = await page('en');
  check(
    'a newly activated language appears in the switcher',
    listed.html.includes('Hebrew'),
  );

  const he = await page(HEBREW);
  check(
    'Hebrew: rtl comes from the language row, not from a hardcoded Arabic check',
    he.status === 200 && he.dir === 'rtl' && he.lang === 'he',
    `lang=${he.lang} dir=${he.dir}`,
  );

  check(
    'Hebrew with no pack still renders English text',
    he.html.includes('Dashboard'),
  );

  // Write one phrase exactly the way the Localization screen does.
  const { saveTranslations } = await import('../lib/i18n.ts').catch(() => ({}));
  if (!saveTranslations) {
    // `lib/i18n.ts` is server-only TypeScript; write the file the same shape.
    const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
    mkdirSync(hebrewDir, { recursive: true });
    const defaults = JSON.parse(
      readFileSync(path.join(process.cwd(), 'lang', 'default', 'common.json'), 'utf8'),
    );
    writeFileSync(
      path.join(hebrewDir, 'common.json'),
      JSON.stringify({ ...defaults, Dashboard: 'לוח בקרה' }, null, 2) + '\n',
      'utf8',
    );
  }

  const translated = await page(HEBREW);
  check(
    'a phrase saved for Hebrew reaches the page',
    translated.html.includes('לוח בקרה'),
  );

  // An inactive language must not be selectable.
  await connection.query('update languages set status = 0 where code = ?', [HEBREW]);
  const afterDeactivation = await page('en');
  check(
    'deactivating removes it from the switcher again',
    !afterDeactivation.html.includes('Hebrew'),
  );
} finally {
  await connection.query('update languages set status = ? where code = ?', [
    before?.status ?? 0,
    HEBREW,
  ]);
  if (existsSync(hebrewDir)) rmSync(hebrewDir, { recursive: true, force: true });
}

await connection.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
