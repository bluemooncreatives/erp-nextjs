import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { SignJWT } from 'jose';

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const PROJECT = 'C:\\Users\\PRATIK\\Downloads\\Software\\erp\\next-js-erp';

function parseEnv(file) {
  const values = {};
  if (!existsSync(file)) return values;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    values[t.slice(0, i).trim()] = v;
  }
  return values;
}
const env = { ...parseEnv(`${PROJECT}\\.env`), ...parseEnv(`${PROJECT}\\.env.local`) };

const base = process.env.BASE_URL ?? 'http://localhost:3100';
const secret = env.SESSION_SECRET;
const cookieName = env.SESSION_COOKIE ?? 'infix_biz_session';

const connection = await mysql.createConnection({
  host: env.DB_HOST ?? 'localhost',
  port: Number(env.DB_PORT ?? 3306),
  user: env.DB_USERNAME ?? 'root',
  password: env.DB_PASSWORD ?? '',
  database: env.DB_DATABASE ?? 'software_erp',
});

const [[admin]] = await connection.query(
  `select u.id, u.role_id, r.type from users u left join roles r on r.id = u.role_id order by u.role_id asc limit 1`,
);
const token = await new SignJWT({
  uid: admin.id, roleId: admin.role_id, roleType: admin.type ?? 'system_user',
  showroomId: 1, staffId: null, locale: 'en',
}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(new TextEncoder().encode(secret));

const urls = [
  '/sale/sale-pdf/1',
  '/sale/sale-challan-pdf/1',
  '/purchase/purchase-order-pdf/1',
  '/quotation/quotation-order-pdf/1',
  '/hr/payroll/pdf/1',
  '/hr/staff/report-print/1',
  '/report/ledger-report/print-view-ledger/2',
  '/leave/leave-application/download/1',
  '/attendance/attendance/attendence-report-print/1/1/2025',
];

let failed = 0;
for (const url of urls) {
  try {
    const res = await fetch(`${base}${url}`, { headers: { cookie: `${cookieName}=${token}` } });
    const buf = Buffer.from(await res.arrayBuffer());
    const magic = buf.subarray(0, 5).toString('ascii');
    const ok = res.status === 200 && res.headers.get('content-type') === 'application/pdf' && magic === '%PDF-';
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${url}  status=${res.status} type=${res.headers.get('content-type')} bytes=${buf.length} magic=${JSON.stringify(magic)}`);
    if (!ok) { failed++; if (!ok && res.status >= 400) console.log(buf.toString('utf8').slice(0, 500)); }
  } catch (error) {
    console.log(`FAIL ${url}  ${error.message}`);
    failed++;
  }
}

await connection.end();
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
