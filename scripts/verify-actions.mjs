// Submits server actions to a RUNNING server and checks what they wrote.
//
//   BASE_URL=http://127.0.0.1:3100 DB_HOST=... node scripts/verify-actions.mjs
//
// The HTTP sweep only issues GETs, so form handling was never exercised over
// the wire. This posts each action the way a browser without JavaScript does -
// a multipart form carrying `$ACTION_ID_<id>` - which is also the path Next
// uses before hydration, then asserts the rows in the database.
//
// It WRITES. Point it at a scratch database, never at production.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const secret = process.env.SESSION_SECRET || process.env.APP_KEY || 'infix-biz-dev-secret';
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
  const page = Object.keys(value.workers)[0];
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

const rows = async (sql, params = []) => (await connection.query(sql, params))[0];
const one = async (sql, params = []) => (await rows(sql, params))[0];

// --- Scenarios -------------------------------------------------------------

const results = [];
async function scenario(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.message ?? error).split('\n')[0] });
  }
}

const stamp = Date.now().toString().slice(-6);

await scenario('printer: create, update and delete through the form', async () => {
  const save = action('savePrinter');
  const remove = action('deletePrinterAction');

  const created = await submit(save, {
    name: `Verify Printer ${stamp}`,
    connection_type: 'network',
    char_per_line: '40',
    ip: '10.1.1.1',
    port: '9100',
    path: '/dev/lp0',
  });
  assert.ok(created.status < 400, `create returned ${created.status}`);

  const row = await one('select * from printers where name = ?', [`Verify Printer ${stamp}`]);
  assert.ok(row, 'the printer was written');
  assert.equal(row.ip, '10.1.1.1');

  const updated = await submit(save, {
    id: row.id,
    name: `Verify Printer ${stamp}`,
    connection_type: 'windows',
    char_per_line: '48',
    ip: '10.1.1.2',
    port: '9100',
    path: '/dev/lp1',
  });
  assert.ok(updated.status < 400, `update returned ${updated.status}`);

  const after = await one('select * from printers where id = ?', [row.id]);
  assert.equal(after.ip, '10.1.1.2', 'the update reached the row');
  assert.equal(after.connection_type, 'windows');

  await submit(remove, { id: row.id });
  assert.equal(
    await one('select * from printers where id = ?', [row.id]),
    undefined,
    'the delete removed the row',
  );
});

await scenario('printer: a missing field is reported, not written', async () => {
  const save = action('savePrinter');
  const before = (await rows('select count(*) as n from printers'))[0].n;

  const response = await submit(save, { name: '', connection_type: '', char_per_line: '' });
  assert.ok(response.status < 500, `validation returned ${response.status}`);

  const after = (await rows('select count(*) as n from printers'))[0].n;
  assert.equal(after, before, 'nothing was written for an invalid form');
});

await scenario('coupon: unique code is enforced by the action', async () => {
  const store = action('storeCoupon');
  const code = `VERIFY-${stamp}`;

  const first = await submit(store, {
    code,
    discount_type: '1',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    cause: 'verify',
    status: '1',
  });
  assert.ok(first.status < 400, `create returned ${first.status}`);
  assert.ok(await one('select * from coupons where code = ?', [code]), 'the coupon exists');

  await submit(store, {
    code,
    discount_type: '1',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    status: '1',
  });

  const all = await rows('select * from coupons where code = ?', [code]);
  assert.equal(all.length, 1, 'the duplicate code was refused');
});

await scenario('coupon: an end date before the start date is refused', async () => {
  const store = action('storeCoupon');
  const code = `VERIFY-BAD-${stamp}`;

  await submit(store, {
    code,
    discount_type: '1',
    start_date: '2026-12-31',
    end_date: '2026-01-01',
    status: '1',
  });

  assert.equal(
    await one('select * from coupons where code = ?', [code]),
    undefined,
    'no row for an invalid date range',
  );
});

await scenario('branch: the reference form writes name and contact details', async () => {
  const save = action('saveShowRoom');
  const name = `Verify Branch ${stamp}`;

  const response = await submit(save, {
    name,
    email: 'branch@example.com',
    phone: '0170000000',
    address: 'Verify Street',
    status: '1',
  });
  assert.ok(response.status < 400, `create returned ${response.status}`);

  const row = await one('select * from show_rooms where name = ?', [name]);
  assert.ok(row, 'the branch was written');
  assert.equal(row.email, 'branch@example.com');
  assert.equal(row.phone, '0170000000');

  // A branch gets its own ledger account, as `createShowRoomWithAccount` does.
  const account = await one(
    "select * from chart_accounts where contactable_id = ? and contactable_type = 'Modules\\\\Inventory\\\\Entities\\\\ShowRoom'",
    [row.id],
  );
  assert.ok(account, 'the branch has a ledger account');
});

await scenario('contact: the form creates the contact and its ledger account', async () => {
  const store = action('storeContact');
  const name = `Verify Customer ${stamp}`;

  const response = await submit(store, {
    contact_type: 'Customer',
    name,
    mobile: '0180000000',
    address: 'Verify Avenue',
    opening_balance: '0',
  });
  assert.ok(response.status < 400, `create returned ${response.status}`);

  const row = await one('select * from contacts where name = ?', [name]);
  assert.ok(row, 'the contact was written');
  assert.ok(row.contact_id, 'the contact code was stamped');

  const account = await one(
    "select * from chart_accounts where contactable_id = ? and contactable_type = 'Modules\\\\Contact\\\\Entities\\\\ContactModel'",
    [row.id],
  );
  assert.ok(account, 'the contact has a ledger account');
});

await scenario('receipt voucher: the form posts both legs', async () => {
  const save = action('saveReceiptVoucher');

  const from = await one(
    "select * from chart_accounts where is_group = 0 and status = 1 and (parent_id = 5 or configuration_group_id = 3) limit 1",
  );
  const to = await one(
    'select * from chart_accounts where is_group = 0 and status = 1 and configuration_group_id in (1, 2) limit 1',
  );
  if (!from || !to) return; // nothing to post between in this dataset

  const before = (await rows('select count(*) as n from vouchers'))[0].n;

  const response = await submit(save, {
    date: new Date().toISOString().slice(0, 10),
    credit_account_id: from.id,
    debit_account_id: to.id,
    debit_account_amount: '250',
    narration: `verify-actions ${stamp}`,
  });
  assert.ok(response.status < 400, `create returned ${response.status}`);

  const after = (await rows('select count(*) as n from vouchers'))[0].n;
  assert.equal(after, before + 1, 'one voucher was written');

  const voucher = await one('select * from vouchers order by id desc limit 1');
  const legs = await rows(
    "select * from transactions where voucherable_id = ? and voucherable_type = 'Modules\\\\Account\\\\Entities\\\\Voucher'",
    [voucher.id],
  );
  assert.equal(legs.length, 2, 'two legs were posted');
  assert.equal(
    legs.filter((l) => l.type === 'Dr').length,
    1,
    'exactly one debit leg',
  );
});

await scenario('receipt voucher: an unknown account is refused', async () => {
  const save = action('saveReceiptVoucher');
  const before = (await rows('select count(*) as n from vouchers'))[0].n;

  await submit(save, {
    date: new Date().toISOString().slice(0, 10),
    credit_account_id: '999999',
    debit_account_id: '999998',
    debit_account_amount: '10',
  });

  const after = (await rows('select count(*) as n from vouchers'))[0].n;
  assert.equal(after, before, 'nothing was posted');
});

await scenario('brand import: an uploaded CSV reaches the table', async () => {
  const upload = action('uploadBrandCsv');
  const csv = `name,description\nVerify Brand ${stamp},from verify-actions\n`;

  const response = await submit(
    upload,
    { file: new Blob([csv], { type: 'text/csv' }) },
    { filename: 'brands.csv' },
  );
  assert.ok(response.status < 400, `upload returned ${response.status}`);

  const row = await one('select * from brands where name = ?', [`Verify Brand ${stamp}`]);
  assert.ok(row, 'the imported brand is in the table');
  assert.equal(row.status, 1);
});

await scenario('permission: a staff session cannot run an admin action', async () => {
  const save = action('savePrinter');
  const staffToken = await sessionFor(3);
  const name = `Denied Printer ${stamp}`;

  const response = await submit(
    save,
    {
      name,
      connection_type: 'network',
      char_per_line: '40',
      ip: '10.9.9.9',
      port: '9100',
      path: '/dev/lp9',
    },
    { token: staffToken },
  );

  assert.ok(response.status >= 400 || response.status === 200, 'the request completed');
  assert.equal(
    await one('select * from printers where name = ?', [name]),
    undefined,
    'the denied action wrote nothing',
  );
});

await scenario('signed out: an action writes nothing', async () => {
  const save = action('savePrinter');
  const name = `Anonymous Printer ${stamp}`;

  await submit(
    save,
    {
      name,
      connection_type: 'network',
      char_per_line: '40',
      ip: '10.8.8.8',
      port: '9100',
      path: '/dev/lp8',
    },
    { token: 'not-a-session' },
  );

  assert.equal(
    await one('select * from printers where name = ?', [name]),
    undefined,
    'an unauthenticated action wrote nothing',
  );
});

const failed = results.filter((r) => !r.ok);
console.log(
  `ran ${results.length} action scenarios: ${results.length - failed.length} ok, ${failed.length} failed`,
);
for (const result of results) {
  console.log(`  ${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.ok ? '' : ` - ${result.error}`}`);
}

await connection.end();
process.exit(failed.length ? 1 : 0);
