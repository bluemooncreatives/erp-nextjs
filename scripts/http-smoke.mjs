// Fetches every page of a RUNNING server and reports non-OK responses.
//
//   BASE_URL=http://localhost:3000 node scripts/http-smoke.mjs
//
// A session cookie is minted with the app's own SESSION_SECRET so the pages
// render as a signed-in super admin instead of redirecting to the login screen.
// Routes are discovered from the app directory, so new pages are covered
// automatically; dynamic segments are filled from the database.

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { SignJWT } from 'jose';
import mysql from 'mysql2/promise';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';

loadEnv();

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const root = process.cwd();

// --- Session cookie --------------------------------------------------------

const secret = requireSessionSecret();
const cookieName = process.env.SESSION_COOKIE ?? 'infix_biz_session';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'software_erp',
});

// ROLE_ID lets the sweep run as a less privileged user, to check that missing
// permissions redirect rather than crash; USER_ID picks one exact account, which
// is how the customer-portal pages get a user whose `contact_id` resolves.
const filters = [];
if (process.env.ROLE_ID) filters.push(`u.role_id = ${Number(process.env.ROLE_ID)}`);
if (process.env.USER_ID) filters.push(`u.id = ${Number(process.env.USER_ID)}`);
const where = filters.length ? `where ${filters.join(' and ')}` : '';
const [[admin]] = await connection.query(
  `select u.id, u.role_id, u.contact_id, r.type from users u
     left join roles r on r.id = u.role_id
   ${where}
    order by u.role_id asc limit 1`,
);
if (!admin) {
  console.error(`no user found${where ? ` for ${where.slice(6)}` : ''}`);
  process.exit(2);
}
const [[showroom]] = await connection.query('select id from show_rooms limit 1');

const token = await new SignJWT({
  uid: admin?.id ?? 1,
  roleId: admin?.role_id ?? 1,
  roleType: admin?.type ?? 'system_user',
  showroomId: showroom?.id ?? 1,
  staffId: null,
  locale: 'en',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('2h')
  .sign(new TextEncoder().encode(secret));

// --- Sample ids for dynamic segments ---------------------------------------

async function firstId(table, column = 'id') {
  try {
    const [rows] = await connection.query(
      `select \`${column}\` as v from \`${table}\` order by \`${column}\` asc limit 1`,
    );
    return rows[0]?.v ?? null;
  } catch {
    return null;
  }
}

/** Vouchers share one table, so each screen needs one of its own kind. */
async function firstVoucherId(paymentType) {
  try {
    const [rows] = await connection.query(
      'select id from vouchers where payment_type = ? order by id asc limit 1',
      [paymentType],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// A contact user only ever sees its own documents, so the portal screens need
// a sale that belongs to it rather than the lowest id in the table.
async function ownSaleId(contactId) {
  if (!contactId) return null;
  try {
    const [rows] = await connection.query(
      'select id from sales where customer_id = ? order by id asc limit 1',
      [Number(contactId)],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

const ids = {
  sale: (await ownSaleId(admin.contact_id)) ?? (await firstId('sales')),
  purchase: await firstId('purchase_orders'),
  quotation: await firstId('quotations'),
  contact: await firstId('contacts'),
  product: await firstId('products'),
  combo: await firstId('combo_products'),
  staff: await firstId('staffs'),
  voucher: await firstId('vouchers'),
  journalVoucher: await firstVoucherId('journal_voucher'),
  contraVoucher: await firstVoucherId('contra_voucher'),
  paymentVoucher: await firstVoucherId('voucher_payment'),
  receiveVoucher: await firstVoucherId('voucher_recieve'),
  account: await firstId('chart_accounts'),
  bank: await firstId('bank_accounts'),
  showroom: await firstId('show_rooms'),
  transfer: await firstId('stock_transfers'),
  adjustment: await firstId('stock_adjustments'),
  theme: await firstId('themes'),
  language: await firstId('languages'),
  expense: await firstId('expenses'),
  income: await firstId('incomes'),
  project: await firstId('projects', 'uuid'),
  task: await firstId('project_task', 'id'),
  team: await firstId('teams'),
  pos: (await connection.query('select id from sales where type=2 order by id desc limit 1'))[0][0]?.id,
  task: (await connection.query('select uuid from tasks limit 1'))[0][0]?.uuid,
};

/** Which sample id a given route should use for its `[id]`. */
function idFor(route) {
  if (route.startsWith('/pos/receipt')) return ids.pos;
  if (route.startsWith('/sale/') || route.startsWith('/my-details/sale')) return ids.sale;
  if (route.startsWith('/purchase/purchase_order')) return ids.purchase;
  if (route.startsWith('/quotation')) return ids.quotation;
  if (route.startsWith('/contact')) return ids.contact;
  if (route.includes('/combo-edit')) return ids.combo;
  if (route.startsWith('/product/add_product')) return ids.product;
  if (route.startsWith('/hr/staff')) return ids.staff;
  if (route.includes('/voucher/journal')) return ids.journalVoucher;
  if (route.includes('/voucher/contra')) return ids.contraVoucher;
  if (route.includes('/voucher/payment')) return ids.paymentVoucher;
  if (route.includes('/voucher/recieve')) return ids.receiveVoucher;
  if (route.includes('/voucher/')) return ids.voucher;
  if (route.includes('bank_accounts')) return ids.bank;
  if (route.includes('chart-account')) return ids.account;
  if (route.includes('showroom')) return ids.showroom;
  if (route.includes('stock-transfer')) return ids.transfer;
  if (route.includes('stock-adjustment')) return ids.adjustment;
  if (route.includes('themes')) return ids.theme;
  if (route.includes('localization')) return ids.language;
  if (route.includes('/account/expenses')) return ids.expense;
  if (route.includes('/account/income')) return ids.income;
  if (route.includes('/team')) return ids.team;
  return ids.contact ?? 1;
}

// --- Route discovery -------------------------------------------------------

function routesUnder(directory, prefix = '') {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      // Route groups `(x)` and private folders `_x` do not appear in the URL.
      const segment = entry.startsWith('(') || entry.startsWith('_') ? '' : `/${entry}`;
      found.push(...routesUnder(full, prefix + segment));
    } else if (entry === 'page.tsx') {
      found.push(prefix === '' ? '/' : prefix);
    }
  }
  return found;
}

const discovered = routesUnder(path.join(root, 'app'));

const routes = discovered
  // Optional catch-alls and the login screen are not useful here.
  .filter((route) => !route.includes('[[') && route !== '/login')
  .map((route) =>
    route
      .replace(/\[uuid\]/g, route.startsWith('/task/') ? ids.task ?? '' : ids.project ?? '')
      .replace(/\[token\]/g, 'sample-token')
      .replace(/\[hash\]/g, 'sample-hash')
      .replace(/\[id\]/g, (m, offset, whole) => String(idFor(whole) ?? 1)),
  )
  .filter((route) => !route.includes('[') && !route.includes(']'))
  .sort();

// --- Fetch -----------------------------------------------------------------

const failures = [];
const byStatus = new Map();
let ok = 0;

for (const route of routes) {
  const url = `${base}${route}`;
  try {
    const response = await fetch(url, {
      headers: { cookie: `${cookieName}=${token}` },
      redirect: 'manual',
    });

    // 2xx renders, 3xx redirects (permission or notFound) and 404 for a row
    // that does not exist are all acceptable; 5xx is not.
    if (response.status >= 500) {
      const body = await response.text();
      const detail = /<h2[^>]*>([^<]+)<\/h2>/.exec(body)?.[1] ?? `${body.slice(0, 160)}`;
      failures.push({ route, status: response.status, detail });
    } else {
      ok++;
      byStatus.set(response.status, (byStatus.get(response.status) ?? 0) + 1);
      if (process.env.VERBOSE && response.status !== 200) {
        console.log(`  ${response.status} ${route} -> ${response.headers.get('location') ?? ''}`);
      }
    }
  } catch (error) {
    failures.push({ route, status: 'fetch failed', detail: String(error?.message ?? error) });
  }
}

const spread = [...byStatus.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([status, count]) => `${status}x${count}`)
  .join(' ');
console.log(`fetched ${routes.length} routes: ${ok} ok, ${failures.length} failed (${spread})`);
for (const failure of failures) {
  console.log(`  FAIL ${failure.route} -> ${failure.status}: ${failure.detail}`);
}

await connection.end();
process.exit(failures.length ? 1 : 0);
