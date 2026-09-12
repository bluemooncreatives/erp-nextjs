// Drives the running app in a real headless browser.
//
//   BASE_URL=http://localhost:3100 DB_HOST=... node scripts/verify-browser.mjs
//
// `verify:actions` posts forms the way a browser without JavaScript does, which
// leaves the interactive half of the bigger screens untested: the product
// picker, the running totals, the edit button that reloads a row into the form.
// This opens the pages in Chrome (or Edge), clicks through them, and checks
// both what the page shows and what reached the database.
//
// It WRITES through the UI. Point it at a scratch database.
//
// Against a `next dev` server, use an origin that `allowedDevOrigins` in
// next.config.ts covers (localhost is always allowed). Development rejects the
// hot-reload WebSocket handshake from any other origin, and the dev client then
// never boots, so the page renders but nothing hydrates and every click is a
// no-op - a failure that looks like broken application code.

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { launchBrowser, openPage, findBrowser, sleep } from './lib/cdp.mjs';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';

loadEnv();

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const base = process.env.BASE_URL ?? 'http://localhost:3100';
const secret = requireSessionSecret();
const cookieName = process.env.SESSION_COOKIE ?? 'infix_biz_session';

if (!findBrowser()) {
  console.log('no Chrome or Edge available; skipping the browser checks');
  process.exit(0);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'software_erp',
});

const rows = async (sql, params = []) => (await connection.query(sql, params))[0];
const one = async (sql, params = []) => (await rows(sql, params))[0];

const [[admin]] = await connection.query(
  `select u.id, u.role_id, r.type from users u
     left join roles r on r.id = u.role_id
    order by u.role_id asc limit 1`,
);
const [[branch]] = await connection.query('select id from show_rooms limit 1');

const token = await new SignJWT({
  uid: admin?.id ?? 1,
  roleId: admin?.role_id ?? 1,
  roleType: admin?.type ?? 'system_user',
  showroomId: branch?.id ?? 1,
  staffId: null,
  locale: 'en',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('2h')
  .sign(new TextEncoder().encode(secret));

const browser = await launchBrowser({ port: Number(process.env.CDP_PORT ?? 9333) });
const page = await openPage(browser);
// The cookie has to be scoped to the host BASE_URL actually uses: a cookie set
// for 127.0.0.1 is never sent to localhost, and every scenario then times out
// on a login page.
await page.setCookie(cookieName, token, new URL(base).hostname);

// Bound as a parameter: MySQL unescapes backslashes inside string literals.
const SALE_MORPH = 'Modules\\Sale\\Entities\\Sale';

const stamp = Date.now().toString().slice(-6);
const results = [];

async function scenario(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.message ?? error).split('\n')[0] });
  }
}

/** Set a React-controlled input and fire the events React listens for. */
const setValue = (selector, value) => `
  (() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('missing ' + ${JSON.stringify(selector)});
    const proto = el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  })()
`;

const clickText = (text, tag = 'button') => `
  (() => {
    const el = [...document.querySelectorAll(${JSON.stringify(tag)})]
      .find((node) => node.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (!el) throw new Error('no ${tag} matching ' + ${JSON.stringify(text)});
    el.click();
    return true;
  })()
`;

// --- Scenarios -------------------------------------------------------------

await scenario('the dashboard renders and hydrates without a client error', async () => {
  await page.goto(`${base}/home`);

  const title = await page.evaluate('document.title');
  assert.ok(title && title.length > 0, 'the page has a title');

  // The design system's sidebar is a plain element carrying `data-slot`, not an
  // <aside>, so the shell is checked by that marker plus the header's own
  // sidebar trigger - the two parts every authenticated page renders.
  const shell = await page.evaluate(
    "Boolean(document.querySelector('[data-slot=\"sidebar\"]') && document.querySelector('[data-sidebar=\"trigger\"]'))",
  );
  assert.ok(shell, 'the shell rendered');

  // React has taken over once its own fibers are attached to the DOM.
  const hydrated = await page.evaluate(
    "[...document.querySelectorAll('*')].some((node) => Object.getOwnPropertyNames(node).some((key) => key.startsWith('__react')))",
  );
  assert.ok(hydrated, 'the page hydrated');
});

await scenario('reference screen: Edit loads the row into the form', async () => {
  // Seed a printer with distinctive values, then check the edit button fills in
  // the extra fields - the bug that made these screens 500 was in this path.
  const name = `Browser Printer ${stamp}`;
  await connection.query(
    'insert into printers (name, connection_type, char_per_line, ip, port, path, created_at) values (?,?,?,?,?,?,now())',
    [name, 'network', '42', '10.4.4.4', '9100', '/dev/lp4'],
  );

  await page.goto(`${base}/setup/printer`);
  await page.waitUntil(`document.body.textContent.includes(${JSON.stringify(name)})`);


  const clickEdit = `
    (() => {
      const row = [...document.querySelectorAll('tr')]
        .find((tr) => tr.textContent.includes(${JSON.stringify(name)}));
      if (!row) throw new Error('row not found');
      const edit = [...row.querySelectorAll('button')]
        .find((b) => b.textContent.trim() === 'Edit');
      if (!edit) throw new Error('no edit button');
      edit.click();
      return true;
    })()
  `;

  await page.interactUntil(
    clickEdit,
    `document.querySelector('input[name="ip"]')?.value === '10.4.4.4'`,
  );

  const filled = await page.evaluate(`
    ({
      name: document.querySelector('input[name="name"]').value,
      ip: document.querySelector('input[name="ip"]').value,
      line: document.querySelector('input[name="char_per_line"]').value,
    })
  `);

  assert.equal(filled.name, name, 'the name was loaded');
  assert.equal(filled.ip, '10.4.4.4', 'the extra fields were loaded too');
  assert.equal(filled.line, '42');
});

await scenario('sale form: the picker adds a line and the totals follow', async () => {
  const stock = await one(
    `select s.*, ps.id as sku_id from stock_reports s
       join product_sku ps on ps.id = s.product_sku_id
      where cast(s.stock as decimal(20,2)) >= 2 limit 1`,
  );
  if (!stock) return;

  const locationRef = String(stock.houseable_type).endsWith('WareHouse')
    ? `warehouse-${stock.houseable_id}`
    : `showroom-${stock.houseable_id}`;

  await page.goto(`${base}/sale/sale/create`);
  await page.waitUntil(`document.querySelector('select[name="customer_id"]')`);

  // Pick a real customer and the branch that actually holds the stock.
  await page.evaluate(`
    (() => {
      const select = document.querySelector('select[name="customer_id"]');
      const option = [...select.options].find((o) => o.value.startsWith('customer-'));
      if (!option) throw new Error('no customer options');
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, option.value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return option.value;
    })()
  `);

  await page.evaluate(setValue('select[name="warehouse_id"]', locationRef));
  await sleep(600); // the picker reloads for the chosen location

  // The picker's values are `sku:<id>`; choose the SKU that has the stock.
  const picked = await page.evaluate(`
    (() => {
      const select = document.querySelector('select[name="_picker"]');
      if (!select) throw new Error('no product picker');
      const wanted = 'sku:' + ${JSON.stringify(String(stock.sku_id))};
      const option = [...select.options].find((o) => o.value === wanted)
        ?? [...select.options].find((o) => o.value.startsWith('sku:'));
      if (!option) throw new Error('the picker has no products');
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, option.value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return option.value;
    })()
  `);
  assert.ok(picked.startsWith('sku:'), 'a stocked product was picked');

  await page.waitUntil(`document.querySelectorAll('input[name="item_quantity"]').length > 0`);

  await page.evaluate(setValue('input[name="item_price"]', '200'));
  await page.evaluate(setValue('input[name="item_quantity"]', '2'));
  await sleep(400);

  // The hidden totals the action reads are computed on the client. The line
  // carries the SKU's own tax rate, which the row total includes - the invoice
  // level `total_tax` is a separate select and stays at zero here.
  const totals = await page.evaluate(`
    ({
      item: document.querySelector('input[name="item_amount"]')?.value,
      quantity: document.querySelector('input[name="total_quantity"]')?.value,
      payable: document.querySelector('input[name="total_amount"]')?.value,
      lineTax: document.querySelector('input[name="product_tax"]')?.value,
      lineDiscount: document.querySelector('input[name="item_discount"]')?.value,
    })
  `);

  const expected = 200 * 2 * (1 + Number(totals.lineTax ?? 0) / 100);

  assert.equal(Number(totals.quantity), 2, 'the quantity total followed the row');
  assert.equal(Number(totals.lineDiscount), 0, 'no discount was applied');
  assert.equal(
    Number(totals.item),
    expected,
    `the line total is price x quantity plus ${totals.lineTax}% tax`,
  );
  assert.equal(Number(totals.payable), expected, 'the payable total followed');

  const reference = `BROWSER-SALE-${stamp}`;
  await page.evaluate(setValue('input[name="ref_no"]', reference));

  const before = (await rows('select count(*) as n from sales'))[0].n;
  await page.evaluate(clickText('Save Sale'));

  // On success the action redirects to the invoice; on failure it renders a
  // banner, so report that rather than a bare timeout.
  try {
    await page.waitUntil(`!location.pathname.endsWith('/create')`, { timeout: 25000 });
  } catch {
    const banner = await page.evaluate(`
      (document.querySelector('[role="alert"]')?.textContent ?? '').trim()
    `);
    assert.fail(`the sale did not save: ${banner || 'no message shown'}`);
  }

  const after = (await rows('select count(*) as n from sales'))[0].n;
  assert.equal(after, before + 1, 'the sale was written');

  const sale = await one('select * from sales where ref_no = ?', [reference]);
  assert.ok(sale, 'the sale carries the reference typed into the form');
  assert.equal(
    Number(sale.payable_amount),
    expected,
    'the total the page showed is the total that was stored',
  );
  assert.equal(Number(sale.total_quantity), 2);

  const line = await one(
    'select * from product_item_details where itemable_id = ? and itemable_type = ?',
    [sale.id, SALE_MORPH],
  );
  assert.ok(line, 'the picked product reached the invoice');
  assert.equal(Number(line.quantity), 2);
  assert.equal(Number(line.price), 200, 'the price typed into the row was stored');
});

await scenario('product form: the type selector swaps the fields it should', async () => {
  await page.goto(`${base}/product/add_product`);
  await page.waitUntil(`document.querySelector('select[name="product_type"]')`);

  // Single shows the SKU and price fields.
  const single = await page.evaluate(
    "Boolean(document.querySelector('input[name=\\\"product_sku\\\"]'))",
  );
  assert.ok(single, 'the single-product fields are shown by default');

  await page.interactUntil(
    setValue('select[name="product_type"]', 'Combo'),
    `document.querySelector('select[name="selected_product_id"]')`,
  );

  const combo = await page.evaluate(`
    ({
      picker: Boolean(document.querySelector('select[name="selected_product_id"]')),
      comboPrice: Boolean(document.querySelector('input[name="combo_selling_price"]')),
      sku: Boolean(document.querySelector('input[name="product_sku"]')),
    })
  `);
  assert.ok(combo.picker, 'the combo item picker appeared');
  assert.ok(combo.comboPrice, 'the combo price field appeared');
  assert.equal(combo.sku, false, 'the single-product SKU field is hidden');

  await page.interactUntil(
    setValue('select[name="product_type"]', 'Variable'),
    `document.body.textContent.includes('Variant')`,
  );

  const variable = await page.evaluate(
    "Boolean(document.body.textContent.includes('Variant') || document.querySelector('select[name=\\\"selected_variant\\\"]'))",
  );
  assert.ok(variable, 'the variable-product section appeared');
});

await scenario('voucher form: a second posting line can be added', async () => {
  await page.goto(`${base}/account/voucher/journal-create`);
  await page.waitUntil('document.querySelectorAll(\'select\').length > 0');

  const before = await page.evaluate(
    `document.querySelectorAll('input[name="sub_amount"]').length`,
  );

  // The click is retried until it lands, so assert that a row appeared rather
  // than an exact count.
  await page.interactUntil(
    clickText('Add line'),
    `document.querySelectorAll('input[name="sub_amount"]').length > ${before}`,
  );

  const after = await page.evaluate(
    `document.querySelectorAll('input[name="sub_amount"]').length`,
  );
  assert.ok(after > before, 'the extra posting line was added');
});

await scenario('contact list: search narrows the table', async () => {
  const contact = await one("select * from contacts where name is not null limit 1");
  if (!contact) return;

  await page.goto(`${base}/contact/add_contact?search=${encodeURIComponent(contact.name)}`);
  await page.waitUntil(`document.body.textContent.includes(${JSON.stringify(contact.name)})`);

  const bodyRows = await page.evaluate(
    "document.querySelectorAll('tbody tr').length",
  );
  assert.ok(bodyRows >= 1, 'the searched contact is listed');
});

await scenario('the main screens load without logging a client-side error', async () => {
  // React reports hydration mismatches and render failures through console.error,
  // which the page collector above captures per document.
  const screens = [
    '/home',
    '/sale/sale',
    '/sale/sale/create',
    '/purchase/purchase_order/create',
    '/product/add_product',
    '/account/voucher/journal-create',
    '/setup/printer',
    '/report/sales-report/index',
  ];

  const noisy = [];
  for (const screen of screens) {
    await page.goto(`${base}${screen}`);
    const errors = (await page.errors()) ?? [];
    // Next logs a hydration hint of its own when an extension alters the DOM;
    // anything else is ours.
    const ours = errors.filter((message) => !/download the React DevTools/i.test(message));
    if (ours.length) noisy.push(`${screen}: ${ours[0]}`);
  }

  assert.deepEqual(noisy, [], 'no screen logged an error');
});

const failed = results.filter((r) => !r.ok);
console.log(
  `ran ${results.length} browser scenarios: ${results.length - failed.length} ok, ${failed.length} failed`,
);
for (const result of results) {
  console.log(`  ${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.ok ? '' : ` - ${result.error}`}`);
}

await page.close();
await browser.close();
await connection.end();
process.exit(failed.length ? 1 : 0);
