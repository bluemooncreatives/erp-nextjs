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
    'select * from chart_accounts where contactable_id = ? and contactable_type = ?',
    [row.id, MORPH.showRoom],
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
    'select * from chart_accounts where contactable_id = ? and contactable_type = ?',
    [row.id, MORPH.contact],
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
    'select * from transactions where voucherable_id = ? and voucherable_type = ?',
    [voucher.id, MORPH.voucher],
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


await scenario('sale: the form fields the action reads produce an invoice', async () => {
  const store = action('storeSale');

  // A SKU with stock at the branch the session is scoped to.
  const stock = await one(
    `select s.*, ps.id as sku_id from stock_reports s
       join product_sku ps on ps.id = s.product_sku_id
      where cast(s.stock as decimal(20,2)) >= 2
      limit 1`,
  );
  const customer = await one("select * from contacts where contact_type = 'Customer' limit 1");
  if (!stock || !customer) return;

  const locationRef =
    stock.houseable_type.endsWith('WareHouse')
      ? `warehouse-${stock.houseable_id}`
      : `showroom-${stock.houseable_id}`;

  const before = (await rows('select count(*) as n from sales'))[0].n;

  const response = await submit(store, {
    customer_id: `customer-${customer.id}`,
    warehouse_id: locationRef,
    date: new Date().toISOString().slice(0, 10),
    ref_no: `VERIFY-SALE-${stamp}`,
    items: stock.sku_id,
    item_price: '100',
    item_quantity: '1',
    product_tax: '0',
    item_discount: '0',
    item_amount: '100',
    total_quantity: '1',
    total_tax: '0-0',
    shipping_charge: '0',
    other_charge: '0',
    total_discount_amount: '0',
    discount_type: '2',
    total_discount: '0',
    total_amount: '100',
  });
  assert.ok(response.status < 400, `create returned ${response.status}`);

  const after = (await rows('select count(*) as n from sales'))[0].n;
  assert.equal(after, before + 1, 'one sale was written');

  const sale = await one('select * from sales where ref_no = ?', [`VERIFY-SALE-${stamp}`]);
  assert.ok(sale, 'the sale carries the reference the form posted');
  assert.equal(Number(sale.payable_amount), 100, 'the posted total was stored');

  const items = await rows(
    'select * from product_item_details where itemable_id = ? and itemable_type = ?',
    [sale.id, MORPH.sale],
  );
  assert.equal(items.length, 1, 'the line reached product_item_details');
  assert.equal(Number(items[0].quantity), 1);
});

await scenario('sale: a form with no lines is refused', async () => {
  const store = action('storeSale');
  const customer = await one("select * from contacts where contact_type = 'Customer' limit 1");
  if (!customer) return;

  const before = (await rows('select count(*) as n from sales'))[0].n;
  await submit(store, {
    customer_id: `customer-${customer.id}`,
    warehouse_id: 'showroom-1',
    date: new Date().toISOString().slice(0, 10),
    ref_no: `VERIFY-EMPTY-${stamp}`,
    total_amount: '0',
  });
  const after = (await rows('select count(*) as n from sales'))[0].n;
  assert.equal(after, before, 'an empty sale was not written');
});

await scenario('purchase: the order form writes the order and its lines', async () => {
  const store = action('storePurchaseOrder');
  const supplier = await one("select * from contacts where contact_type = 'Supplier' limit 1");
  const sku = await one('select * from product_sku limit 1');
  const branch = await one('select * from show_rooms limit 1');
  if (!supplier || !sku || !branch) return;

  const response = await submit(store, {
    supplier_id: supplier.id,
    showroom: `showroom-${branch.id}`,
    date: new Date().toISOString().slice(0, 10),
    ref_no: `VERIFY-PO-${stamp}`,
    product_id: sku.id,
    product_price: '50',
    product_selling_price: '75',
    product_quantity: '4',
    product_tax: '0',
    product_discount: '0',
    item_amount: '200',
    total_quantity: '4',
    total_tax: '0-0',
    shipping_charge: '0',
    other_charge: '0',
    total_discount_amount: '0',
    discount_type: '2',
    total_discount: '0',
    total_amount: '200',
  });
  assert.ok(response.status < 400, `create returned ${response.status}`);

  const order = await one('select * from purchase_orders where ref_no = ?', [`VERIFY-PO-${stamp}`]);
  assert.ok(order, 'the purchase order was written');
  assert.equal(Number(order.payable_amount), 200);

  const items = await rows(
    'select * from product_item_details where itemable_id = ? and itemable_type = ?',
    [order.id, MORPH.purchaseOrder],
  );
  assert.equal(items.length, 1, 'the line reached product_item_details');
  assert.equal(Number(items[0].quantity), 4);
});

await scenario('stock adjustment: the form writes lines and leaves stock alone', async () => {
  const store = action('storeStockAdjustment');
  const stock = await one(
    'select * from stock_reports where cast(stock as decimal(20,2)) >= 1 limit 1',
  );
  if (!stock) return;

  const locationRef = stock.houseable_type.endsWith('WareHouse')
    ? `warehouse-${stock.houseable_id}`
    : `showroom-${stock.houseable_id}`;
  const stockBefore = Number(stock.stock);

  const response = await submit(store, {
    warehouse_id: locationRef,
    date: new Date().toISOString().slice(0, 10),
    ref_no: `VERIFY-ADJ-${stamp}`,
    recovery_amount: '0',
    product_id: stock.product_sku_id,
    product_quantity: '1',
  });
  assert.ok(response.status < 400, `create returned ${response.status}`);

  const adjustment = await one('select * from stock_adjustments where ref_no = ?', [
    `VERIFY-ADJ-${stamp}`,
  ]);
  assert.ok(adjustment, 'the adjustment was written');

  const after = await one('select * from stock_reports where id = ?', [stock.id]);
  assert.equal(
    Number(after.stock),
    stockBefore,
    'stock only moves once the adjustment is approved',
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
