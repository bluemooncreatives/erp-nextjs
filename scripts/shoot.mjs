// Screenshots pages of a running server, for reviewing the interface.
//
//   BASE_URL=http://localhost:3100 node scripts/shoot.mjs /home /sale/lists
//
// Signs in as the first user (or USER_ID) the same way the verification sweeps
// do, so authenticated screens render. Files land in the directory named by
// OUT_DIR, one PNG per path, plus a `-dark` variant when THEME=both.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
import { launchBrowser, openPage, sleep } from './lib/cdp.mjs';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';

loadEnv();

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const base = process.env.BASE_URL ?? 'http://localhost:3100';
const outDir = process.env.OUT_DIR ?? 'screenshots';
const theme = process.env.THEME ?? 'light';
const width = Number(process.env.WIDTH ?? 1440);
const height = Number(process.env.HEIGHT ?? 900);
const paths = process.argv.slice(2);

if (paths.length === 0) {
  console.error('usage: node scripts/shoot.mjs <path> [path...]');
  process.exit(2);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'software_erp',
});

const where = process.env.USER_ID ? `where u.id = ${Number(process.env.USER_ID)}` : '';
const [[user]] = await connection.query(
  `select u.id, u.role_id, r.type from users u
     left join roles r on r.id = u.role_id
   ${where}
    order by u.role_id asc limit 1`,
);
const [[showroom]] = await connection.query('select id from show_rooms limit 1');
await connection.end();

const token = await new SignJWT({
  uid: user?.id ?? 1,
  roleId: user?.role_id ?? 1,
  roleType: user?.type ?? 'system_user',
  showroomId: showroom?.id ?? 1,
  staffId: null,
  locale: process.env.LOCALE ?? 'en',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('2h')
  .sign(new TextEncoder().encode(requireSessionSecret()));

mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser({ port: Number(process.env.CDP_PORT ?? 9360) });
const page = await openPage(browser);

await browser.send(
  'Emulation.setDeviceMetricsOverride',
  { width, height, deviceScaleFactor: 1, mobile: false },
  page.sessionId,
);
// AUTH=0 shoots the guest screens, which would otherwise redirect to /home.
if (process.env.AUTH !== '0') {
  await page.setCookie(
    process.env.SESSION_COOKIE ?? 'infix_biz_session',
    token,
    new URL(base).hostname,
  );
}

const themes = theme === 'both' ? ['light', 'dark'] : [theme];

for (const target of paths) {
  for (const mode of themes) {
    // The theme lives in localStorage, which is per-origin, so it can be set
    // once the first page of that origin has loaded.
    await page.goto(`${base}${target}`);
    await page.evaluate(
      `try { localStorage.setItem('theme', ${JSON.stringify(mode)}); } catch {}`,
    );
    await page.goto(`${base}${target}`);
    await sleep(Number(process.env.SETTLE_MS ?? 2500));

    const { data } = await browser.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: true },
      page.sessionId,
    );

    const name =
      (target === '/' ? 'root' : target.replace(/^\//, '').replace(/[\/?=&]/g, '-')) +
      (mode === 'dark' ? '-dark' : '') +
      '.png';
    const file = path.join(outDir, name);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(file);
  }
}

await page.close();
await browser.close();
