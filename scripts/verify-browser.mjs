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
import { readFileSync, existsSync } from 'node:fs';
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
  if (process.env.SCENARIO_PATTERN && !name.includes(process.env.SCENARIO_PATTERN)) return;
  try {
    await run();
    results.push({ name, ok: true });
    console.log('ok', name);
  } catch (error) {
    console.log('FAIL', name, String(error?.message ?? error));
    console.log('alerts', await page.evaluate("Array.from(document.querySelectorAll('[role=alert]')).map(e=>e.textContent)"));
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

/**
 * Choose an option from the product's Select.
 *
 * It is a Radix listbox, not a `<select>`: the value lives in React state and
 * is mirrored into a hidden input, so assigning to that input changes nothing.
 * Driving it the way a person does - open the trigger, click a row - is also
 * the only way to test what actually ships.
 *
 * `match` is the body of a function taking the option element, so callers can
 * pick by label or by the value the row carries.
 */
async function pickOption(page, name, match, { timeout = 10000 } = {}) {
  await page.waitUntil(`document.querySelector('#' + ${JSON.stringify(name)})`, { timeout });

  await page.evaluate(`
    (() => {
      const trigger = document.querySelector('#' + ${JSON.stringify(name)});
      if (!trigger) throw new Error('no select trigger named ' + ${JSON.stringify(name)});
      trigger.click();
    })()
  `);

  await page.waitUntil(`document.querySelectorAll('[role="option"]').length > 0`, { timeout });

  const chosen = await page.evaluate(`
    (() => {
      const options = [...document.querySelectorAll('[role="option"]')];
      const match = (option) => { ${match} };
      const found = options.find(match);
      if (!found) {
        throw new Error(
          'no option matched in ' + ${JSON.stringify(name)} + '; saw: ' +
            options.map((o) => o.textContent.trim()).slice(0, 8).join(' | '),
        );
      }
      const label = found.textContent.trim();
      found.click();
      return label;
    })()
  `);

  // The listbox closes and the hidden input catches up on the next commit.
  await sleep(250);
  return chosen;
}

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
  // The most-stocked SKU, not merely the first one with two on hand: earlier
  // runs of this suite consume stock, and a row that only just cleared the
  // threshold leaves the sale below it by the time the form posts.
  const stock = await one(
    `select s.*, ps.id as sku_id from stock_reports s
       join product_sku ps on ps.id = s.product_sku_id
      where cast(s.stock as decimal(20,2)) >= 4
      order by cast(s.stock as decimal(20,2)) desc limit 1`,
  );
  if (!stock) return;

  const locationRef = String(stock.houseable_type).endsWith('WareHouse')
    ? `warehouse-${stock.houseable_id}`
    : `showroom-${stock.houseable_id}`;

  await page.goto(`${base}/sale/sale/create`);

  // Pick a real customer and the branch that actually holds the stock.
  await pickOption(page, 'customer_id', "return option.textContent.trim().length > 0;");

  await pickOption(
    page,
    'warehouse_id',
    `return option.dataset.value === ${JSON.stringify(locationRef)}
      || option.getAttribute('data-value') === ${JSON.stringify(locationRef)};`,
  );
  await sleep(600); // the picker reloads for the chosen location

  const wantedSku = `sku:${stock.sku_id}`;
  await pickOption(
    page,
    '_picker',
    `return option.dataset.value === ${JSON.stringify(wantedSku)}
      || option.getAttribute('data-value') === ${JSON.stringify(wantedSku)};`,
  );

  // The picker is a controlled field that clears itself once the line is added,
  // so what proves the pick landed is the row, not the picker's own value.
  await page.waitUntil(`document.querySelectorAll('input[name="item_quantity"]').length > 0`);

  // A non-combo line posts its SKU id as `items`.
  const lineSku = await page.evaluate(
    `document.querySelector('input[type="hidden"][name="items"]')?.value ?? ''`,
  );
  assert.equal(
    lineSku,
    String(stock.sku_id),
    'the line that was added is the SKU that has the stock',
  );

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
  await page.waitUntil(`document.querySelector('#product_type')`);

  // Single shows the SKU and price fields.
  const single = await page.evaluate(
    "Boolean(document.querySelector('input[name=\\\"product_sku\\\"]'))",
  );
  assert.ok(single, 'the single-product fields are shown by default');

  await pickOption(page, 'product_type', "return option.dataset.value === 'Combo';");
  await page.waitUntil(`document.querySelector('#selected_product_id')`);

  const combo = await page.evaluate(`
    ({
      picker: Boolean(document.querySelector('#selected_product_id')),
      comboPrice: Boolean(document.querySelector('input[name="combo_selling_price"]')),
      sku: Boolean(document.querySelector('input[name="product_sku"]')),
    })
  `);
  assert.ok(combo.picker, 'the combo item picker appeared');
  assert.ok(combo.comboPrice, 'the combo price field appeared');
  assert.equal(combo.sku, false, 'the single-product SKU field is hidden');

  await pickOption(page, 'product_type', "return option.dataset.value === 'Variable';");
  await page.waitUntil(`document.body.textContent.includes('Variant')`);

  const variable = await page.evaluate(
    "Boolean(document.body.textContent.includes('Variant') || document.querySelector('#selected_variant'))",
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

await scenario('header: choosing a language switches the interface', async () => {
  await page.goto(`${base}/home`);

  // The switcher is a Radix listbox like every other select here.
  await pickOption(page, 'locale', "return option.textContent.trim() === 'Arabic';");

  // `changeLocale` writes the session and the router refreshes, so the next
  // paint is the whole shell in the chosen language.
  await page.waitUntil(`document.documentElement.dir === 'rtl'`, { timeout: 15000 });

  const after = await page.evaluate(`JSON.stringify({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    sidebar: document.querySelector('[data-slot="sidebar"]').innerText,
  })`);
  const state = JSON.parse(after);

  assert.equal(state.dir, 'rtl', 'the document flipped to right-to-left');
  assert.equal(state.lang, 'ar', 'the document language followed');
  assert.ok(
    state.sidebar.includes('لوحة التحكم'),
    'the navigation is in the chosen language',
  );

  // Put it back, so the rest of the run is unaffected.
  await pickOption(page, 'locale', "return option.textContent.trim() === 'English';");
  await page.waitUntil(`document.documentElement.dir === 'ltr'`, { timeout: 15000 });
});

await scenario('payroll: the payment panel shows bank fields only for a bank payment', async () => {
  const staff = await one('select id from staffs limit 1');
  const [inserted] = await connection.query(
    `insert into payrolls
       (staff_id, role_id, basic_salary, total_earning, total_deduction, gross_salary, tax, net_salary,
        payroll_month, payroll_year, payroll_status, active_status, created_at, updated_at)
     values (?, 1, 15000, 0, 0, 15000, 0, 15000, 'April', '2093', 'Generated', 1, now(), now())`,
    [staff?.id ?? 1],
  );
  const payrollId = inserted.insertId;

  try {
    await page.goto(`${base}/hr/payroll`);
    await page.waitUntil(`document.body.textContent.includes('April 2093')`);

    const openPanel = `
      (() => {
        const row = [...document.querySelectorAll('tr')]
          .find((tr) => tr.textContent.includes('April 2093'));
        if (!row) throw new Error('payroll row not found');
        const summary = row.querySelector('summary');
        if (!summary) throw new Error('no Pay disclosure on the row');
        summary.click();
        return true;
      })()
    `;
    await page.interactUntil(openPanel, `document.querySelector('#payment_mode-${payrollId}')`);

    // Cash is the default - no bank fields until a bank payment is chosen.
    assert.equal(
      await page.evaluate(`Boolean(document.querySelector('#bank_name-${payrollId}'))`),
      false,
      'bank fields are not shown for a cash payment',
    );

    await pickOption(page, `payment_mode-${payrollId}`, "return option.textContent.trim() === 'Bank';");
    await page.waitUntil(`document.querySelector('#bank_name-${payrollId}')`);

    await page.evaluate(setValue(`#payment_date-${payrollId}`, '2093-04-30'));
    await page.evaluate(setValue(`#bank_name-${payrollId}`, 'Verify Bank'));
    await page.evaluate(setValue(`#bank_branch_name-${payrollId}`, 'Verify Branch'));
    await page.evaluate(setValue(`#account_no-${payrollId}`, '000111222'));

    await page.evaluate(`
      (() => {
        const form = document.querySelector('#bank_name-${payrollId}').closest('form');
        [...form.querySelectorAll('button')].find((b) => b.textContent.includes('Pay Now')).click();
      })()
    `);

    await page.waitUntil(
      `document.body.textContent.includes('April 2093') && !document.querySelector('#payment_mode-${payrollId}')`,
      { timeout: 15000 },
    );

    const payroll = await one('select * from payrolls where id = ?', [payrollId]);
    assert.equal(payroll.payroll_status, 'Paid', 'the payroll shows paid after the round trip');
    assert.equal(payroll.payment_mode, 'Bank', 'the chosen method was recorded');
    assert.equal(payroll.bank_name, 'Verify Bank', 'the bank fields shown in the UI were the ones saved');
  } finally {
    const voucher = await one(
      `select id from vouchers where payment_type = 'journal_voucher' and amount = 15000
         and date = curdate() order by id desc limit 1`,
    );
    if (voucher) {
      await rows(
        'delete from tranaction_account where tranaction_id in (select id from transactions where voucherable_id = ? and voucherable_type = ?)',
        [voucher.id, 'Modules\\Account\\Entities\\Voucher'],
      );
      await rows('delete from transactions where voucherable_id = ? and voucherable_type = ?', [
        voucher.id,
        'Modules\\Account\\Entities\\Voucher',
      ]);
      await rows('delete from vouchers where id = ?', [voucher.id]);
    }
    await rows('delete from payroll_earn_deducs where payroll_id = ?', [payrollId]);
    await rows('delete from payrolls where id = ?', [payrollId]);
  }
});

// Additional migration workflows use fixtures created by verify-migration.mjs.
if (process.env.DB_DATABASE?.startsWith('erp_migration_') && existsSync('artifacts/migration-fixture.json')) {
  const fixture = JSON.parse(readFileSync('artifacts/migration-fixture.json', 'utf8'));
  await scenario('POS: select product, take cash, print receipt, and deduct stock', async () => {
    const location = `${fixture.stock.houseable_type === 'Modules\\Inventory\\Entities\\ShowRoom' ? 'showroom' : 'warehouse'}-${fixture.stock.houseable_id}`;
    await page.goto(`${base}/pos/pos-order-products?location=${location}`);
    const customer = await one('select name from contacts where id=?', [fixture.customerId]);
    await pickOption(page, 'customer_id', `return option.textContent.includes(${JSON.stringify(customer.name)});`);
    await page.interactUntil(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.className.includes('text-start') && b.textContent.includes(${JSON.stringify(fixture.stock.product_name)})); if(!button) throw new Error('product tile missing'); button.click(); })()`, `document.querySelector('input[name="items"][value="${fixture.stock.product_sku_id}"]')`);
    await page.evaluate(setValue('input[name="item_price"]', String(fixture.price)));
    await page.evaluate(setValue('input[name="product_tax"]', '0'));
    await page.evaluate(setValue('input[name="ref_no"]', `BROWSER-POS-${stamp}`));
    await page.evaluate(setValue('input[name="payment_amount"]', String(fixture.price + 25)));
    const before = Number((await one('select stock from stock_reports where id=?',[fixture.stock.id])).stock);
    await page.evaluate(clickText('Complete checkout'));
    await page.waitUntil('location.pathname.startsWith("/pos/receipt/")', {timeout:30000});
    const saved = await one('select * from sales where ref_no=?', [`BROWSER-POS-${stamp}`]);
    assert.ok(saved); assert.equal(Number(saved.type),2); assert.equal(Number(saved.is_approved),1);
    assert.equal(Number((await one('select stock from stock_reports where id=?',[fixture.stock.id])).stock),before-1);
    assert.ok(await page.evaluate('document.body.innerText.includes("Change")'));
  });
  await scenario('Project: drag a task between board columns', async () => {
    await page.goto(`${base}/project/${fixture.projectUuid}/board`);
    await page.evaluate(`(() => {
      const card = [...document.querySelectorAll('article[draggable]')].find(a => a.textContent.includes('First task'));
      const column = [...document.querySelectorAll('div.w-80')].find(d => d.querySelector('[data-slot=card-title]')?.textContent.includes('To do'));
      if(!card || !column) throw new Error('board card or column missing');
      const transfer = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
      column.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
    })()`);
    await page.waitUntil(`Array.from(document.querySelectorAll('div.w-80')).some(d => d.querySelector('[data-slot=card-title]')?.textContent.includes('To do') && d.textContent.includes('First task'))`, {timeout:30000});
    assert.equal((await one('select section_id from tasks where id=?',[fixture.taskIds[0]])).section_id,fixture.sectionIds[0]);
    assert.deepEqual(await page.errors(),[]);
  });
  await scenario('Project: create numeric field and edit its value through the UI', async () => {
    await page.goto(`${base}/project/${fixture.projectUuid}/board`);
    await page.evaluate(`(() => { const details=[...document.querySelectorAll('details')].find(d=>d.textContent.includes('Manage custom fields')); details.open=true; })()`);
    const name = `Browser score ${stamp}`;
    const newField = `Array.from(document.forms).find(f => f.querySelector('input[name="field_id"]')?.value === '' && f.querySelector('input[name="project_id"]'))`;
    await page.evaluate(`(() => {const f=${newField}; const el=f.querySelector('input[name="name"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(name)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await pickOption(page,'field-new-type',"return option.textContent.trim() === 'number';");
    await page.evaluate(`(${newField}).querySelector('button[value="save"]').click()`);
    await page.waitUntil(`Array.from(document.forms).some(f=>f.querySelector('input[name="field_id"]')?.value && f.querySelector('input[name="name"]')?.value===${JSON.stringify(name)})`,{timeout:30000});
    const field = await one('select id from fields where name=?',[name]); assert.ok(field,'field saved by form');
    await page.goto(`${base}/task/${fixture.taskUuids[0]}`);
    const valueForm=`Array.from(document.forms).find(f=>f.querySelector('input[name="field_id"]')?.value==='${field.id}')`;
    await page.evaluate(`(() => {const el=(${valueForm}).querySelector('input[name="value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'42'); el.dispatchEvent(new Event('input',{bubbles:true})); (${valueForm}).querySelector('button[value="value"]').click();})()`);
    await page.waitUntil(`(${valueForm}).textContent.includes('Saved.')`,{timeout:30000});
    assert.equal(Number((await one('select number from field_task where field_id=? AND task_id=?',[field.id,fixture.taskIds[0]])).number),42);
  });
}

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
