// Submits server actions to a RUNNING server and checks what they wrote.
//
//   BASE_URL=http://localhost:3100 DB_HOST=... node scripts/verify-actions.mjs
//
// The HTTP sweep only issues GETs, so form handling was never exercised over
// the wire. This posts each action the way a browser without JavaScript does -
// a multipart form carrying `$ACTION_ID_<id>` - which is also the path Next
// uses before hydration, then asserts the rows in the database.
//
// It WRITES. Point it at a scratch database, never at production.

import fs, { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';

loadEnv();
if (!process.env.DB_DATABASE?.startsWith('erp_migration_')) throw new Error('Set DB_DATABASE to an isolated erp_migration_ database.');

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const base = process.env.BASE_URL ?? 'http://localhost:3100';
const secret = requireSessionSecret();
const cookieName = process.env.SESSION_COOKIE ?? 'infix_biz_session';

// --- Action ids ------------------------------------------------------------

const manifest = JSON.parse(
  readFileSync('.next/server/server-reference-manifest.json', 'utf8'),
).node;

/** Find an action by its exported name, and a page that can serve it. */
function action(exportedName, fileHint) {
  const entries = Object.entries(manifest).filter(
    ([, value]) =>
      value.exportedName === exportedName &&
      (!fileHint || String(value.filename).includes(fileHint)),
  );
  assert.equal(entries.length > 0, true, `no action named ${exportedName}`);
  const [id, value] = entries[0];
  // An action is served by every page that imports it. Post to one with no
  // dynamic segment: posting to `/contact/add_contact/[id]/edit` would run the
  // action and then fail rendering the reply, because the literal `[id]` is
  // not a row id - a 500 that says nothing about the action under test.
  const pages = Object.keys(value.workers);
  const page = pages.find((name) => !name.includes('[')) ?? pages[0];
  return { id, url: pageUrl(page) };
}

/** `app/(dashboard)/setup/printer/page` -> `/setup/printer` */
function pageUrl(page) {
  const path = page
    .replace(/^app/, '')
    .replace(/\/page$/, '')
    .replace(/\/\([^)]+\)/g, '');
  return path === '' ? '/' : path;
}

// --- Session ---------------------------------------------------------------

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'software_erp',
});

/** The same session, in a chosen locale - for the translation check. */

async function sessionFor(roleId) {
  const [[user]] = await connection.query(
    `select u.id, u.role_id, r.type from users u
       left join roles r on r.id = u.role_id
      where (? is null or u.role_id = ?)
      order by u.role_id asc limit 1`,
    [roleId ?? null, roleId ?? null],
  );
  assert.ok(user, `no user for role ${roleId}`);

  const [[showroom]] = await connection.query('select id from show_rooms limit 1');

  return new SignJWT({
    uid: user.id,
    roleId: user.role_id,
    roleType: user.type ?? 'system_user',
    showroomId: showroom?.id ?? 1,
    staffId: null,
    locale: 'en',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(secret));
}

const adminToken = await sessionFor(null);

/** Post one action, as a browser without JavaScript would. */
async function submit(target, fields, options = {}) {
  const form = new FormData();
  form.set(`$ACTION_ID_${target.id}`, '');
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item instanceof Blob) form.append(key, item, options.filename ?? 'upload.csv');
      else form.append(key, String(item));
    }
  }

  const response = await fetch(`${base}${options.url ?? target.url}`, {
    method: 'POST',
    headers: {
      cookie: `${cookieName}=${options.token ?? adminToken}`,
      origin: base,
    },
    body: form,
    redirect: 'manual',
  });

  return response;
}

/** The polymorphic class names, bound as parameters - MySQL unescapes
 * backslashes inside string literals, so these cannot be inlined. */
const MORPH = {
  sale: 'Modules\\Sale\\Entities\\Sale',
  purchaseOrder: 'Modules\\Purchase\\Entities\\PurchaseOrder',
  voucher: 'Modules\\Account\\Entities\\Voucher',
  showRoom: 'Modules\\Inventory\\Entities\\ShowRoom',
  contact: 'Modules\\Contact\\Entities\\ContactModel',
};

const rows = async (sql, params = []) => (await connection.query(sql, params))[0];
const one = async (sql, params = []) => (await rows(sql, params))[0];


const stamp = Date.now();
const results = [];
async function scenario(name, run) {
 try { await run(); results.push({name,ok:true}); console.log('ok',name); }
 catch(error) { results.push({name,ok:false,error:String(error)}); console.log('FAIL',name,String(error)); }
}

const first = async table => (await one(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`))?.id;
const pdfRoutes = [
 `/sale/sale-pdf/${await first('sales')}`,
 `/sale/sale-challan-pdf/${await first('sales')}`,
 `/purchase/purchase-order-pdf/${await first('purchase_orders')}`,
 `/quotation/quotation-order-pdf/${await first('quotations')}`,
 `/hr/payroll/pdf/${await first('payrolls')}`,
 `/attendance/attendance/attendence-report-print/1/9/2026`,
 `/hr/staff/report-print/${await first('staffs')}`,
 `/report/ledger-report/print-view-ledger/${await first('chart_accounts')}`,
 `/leave/leave-application/download/${await first('apply_leaves')}`,
];
for (const url of pdfRoutes) await scenario(`PDF ${url}`,async()=>{
 const response=await fetch(base+url,{headers:{cookie:`${cookieName}=${adminToken}`}});
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/pdf/);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1000);
});
await scenario('Customer portal renders with a contact-linked session',async()=>{
 const user=await one('SELECT u.id,u.role_id,r.type FROM users u JOIN roles r ON r.id=u.role_id JOIN contacts c ON c.id=u.contact_id LIMIT 1');
 assert.ok(user,'contact-linked fixture user');
 const token=await new SignJWT({uid:user.id,roleId:user.role_id,roleType:user.type,showroomId:1,staffId:null,locale:'en'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
 for(const url of ['/invoice','/my-details','/my-products','/profile','/return','/transaction']) {
  const response=await fetch(base+url,{headers:{cookie:`${cookieName}=${token}`},redirect:'manual'}); assert.equal(response.status,200,url);
 }
});
if(process.env.VERIFY_BACKUP==='1') await scenario('Backup action creates SQL and restore action restores the isolated database',async()=>{
 const now=new Date();const folder=[String(now.getDate()).padStart(2,'0'),String(now.getMonth()+1).padStart(2,'0'),now.getFullYear()].join('-');
 const file=`public/database-backup/${folder}/${folder}-dump.sql`;
 assert.ok(!fs.existsSync(file),'refuse to overwrite an existing backup');
 const tracked=['sales','tasks','projects','contacts','stock_reports','payrolls'];
 const before=Object.fromEntries(await Promise.all(tracked.map(async t=>[t,(await one(`SELECT COUNT(*) n FROM ${t}`)).n])));
 try {
  const generated=await submit(action('generateBackup'),{});const body=await generated.text();
  assert.ok(fs.existsSync(file),body.match(/mysqldump[^<]{0,200}/)?.[0]??'dump was not created');
  const bytes=fs.readFileSync(file);assert.ok(bytes.length>10000);
  const imported=await submit(action('importBackup'),{db_file:new Blob([bytes],{type:'application/sql'})},{filename:`migration-restore-${stamp}.sql`});
  const reply=await imported.text();assert.ok(imported.status<400);assert.match(reply,/Database import suc|Database import sun/);
  for(const t of tracked) assert.equal((await one(`SELECT COUNT(*) n FROM ${t}`)).n,before[t],t);
 } finally {
  if(fs.existsSync(file)) { await submit(action('removeBackup'),{dir:folder});assert.ok(!fs.existsSync(file)); }
 }
});
fs.writeFileSync('artifacts/operations-results.json',JSON.stringify(results,null,2));
await connection.end();console.log(`${results.filter(r=>r.ok).length}/${results.length} operation scenarios passed`);
process.exitCode=results.some(r=>!r.ok)?1:0;
