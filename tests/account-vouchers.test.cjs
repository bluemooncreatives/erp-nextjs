const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(relativePath, modules) {
  const filename = path.join(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } }, { filename });
  return exports;
}

const VoucherType = { Cash: 'CV', Bank: 'BV', Journal: 'JV', Contra: 'CRV' };
const journal = load('lib/accounting/journal.ts', {
  'server-only': {}, 'drizzle-orm': {}, '@/lib/db/client': {}, '@/lib/db/schema': {},
  '@/lib/db/morph': {}, './vouchers': { VoucherType },
});

function fixture({ approved = false, existingType = 'voucher_payment', denied = false } = {}) {
  const calls = { permissions: [], writes: [] };
  const f = load('app/(dashboard)/account/actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/lib/auth/permissions': { authorize: async (permission) => {
      calls.permissions.push(permission);
      if (denied) throw new Error('forbidden');
      return { id: 7 };
    } },
    '@/lib/auth/session': {}, '@/lib/db/client': {}, '@/lib/db/schema': {}, 'drizzle-orm': {},
    '@/lib/accounting/expenses': {},
    '@/lib/activity-log': { successLog: async () => {}, errorLog: async () => {} },
    '@/lib/routes': { ROUTES: { 'vouchers.index': '/payment', 'journal.index': '/journal', 'contra.index': '/contra' } },
    '@/lib/accounting/vouchers': {
      VoucherType,
      createVoucher: async (data) => calls.writes.push({ operation: 'create', data }),
      updateVoucher: async (id, data) => calls.writes.push({ operation: 'update', id, data }),
      findVoucher: async () => ({ paymentType: existingType }),
    },
    '@/lib/accounting/journal': {
      activeAccounts: async () => [{ id: 10, isGroup: 0 }, { id: 20, isGroup: 0 }, { id: 30, isGroup: 0 }],
      createJournalVoucher: async (data) => calls.writes.push({ operation: 'create', data, legs: journal.buildJournalLegs(data) }),
      updateJournalVoucher: async (id, data) => calls.writes.push({ operation: 'update', id, data, legs: journal.buildJournalLegs(data) }),
    },
    '@/lib/business-settings': { isEnabled: async (key) => { assert.match(key, /^(voucher_payment|journal_voucher|contra_voucher)_approval$/); return approved; } },
    '@/lib/accounting/periods': { openAccountingPeriod: async () => ({ startDate: '2026-04-01' }) },
  });
  return { ...f, calls };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, String(item));
  }
  return data;
}
const payment = { date: '2026-09-12', voucher_type: 'CV', credit_account_id: 10, debit_account_id: [20, 30], debit_account_amount: [40, 60], debit_account_narration: ['First', 'Second'] };
const compound = { date: '2026-09-12', account_type: 'debit', account_id: 10, main_amount: 100, sub_account_id: [20, 30], sub_amount: [40, 60], sub_narration: ['First', 'Second'] };

test('payment creation cannot be changed into an approved receipt by hidden fields', async () => {
  const f = fixture();
  await assert.rejects(f.storeVoucher({}, form({ ...payment, payment_type: 'voucher_recieve', is_approve: 1 })), /redirect/);
  assert.equal(f.calls.writes[0].data.paymentType, 'voucher_payment');
  assert.equal(f.calls.writes[0].data.isApprove, 0);
});

test('new payments enforce the accounting-period start date', async () => {
  const f = fixture();
  const result = await f.storeVoucher({}, form({ ...payment, date: '2026-03-31' }));
  assert.ok(result.fieldErrors.date);
  assert.equal(f.calls.writes.length, 0);
});

test('payment editing loads all lines and uses edit authorization', async () => {
  const f = fixture({ approved: true });
  await assert.rejects(f.updatePaymentVoucher({}, form({ ...payment, id: 42 })), /redirect/);
  assert.deepEqual(f.calls.permissions, ['vouchers.edit']);
  assert.equal(f.calls.writes[0].operation, 'update');
  assert.equal(f.calls.writes[0].data.debitAccountId.length, 2);
  assert.equal(f.calls.writes[0].data.amount, 100);
  assert.equal(f.calls.writes[0].data.isApprove, 1);
});

test('payment editing rejects receipt IDs', async () => {
  const f = fixture({ existingType: 'voucher_recieve' });
  assert.ok((await f.updatePaymentVoucher({}, form({ ...payment, id: 42 }))).error);
  assert.equal(f.calls.writes.length, 0);
});

test('malformed payment arrays cannot silently lose an amount and shift postings', async () => {
  const f = fixture();
  const result = await f.storeVoucher({}, form({ ...payment, debit_account_amount: ['NaN', 60] }));
  assert.ok(result.fieldErrors.debit_account_amount);
  assert.equal(f.calls.writes.length, 0);
});

test('journal keeps the main debit first and reverses credit lines as PHP does', async () => {
  const f = fixture();
  await assert.rejects(f.storeJournalVoucher({}, form(compound)), /redirect/);
  const legs = JSON.parse(JSON.stringify(f.calls.writes[0].legs));
  assert.deepEqual(legs.map(({ accountId, type, amount }) => [accountId, type, amount]), [[10, 'Dr', 100], [30, 'Cr', 60], [20, 'Cr', 40]]);
  assert.equal(f.calls.writes[0].data.isApprove, 0);
});

test('contra supports multiple lines and appends its main credit after debit lines', async () => {
  const f = fixture({ approved: true });
  await assert.rejects(f.storeContraVoucher({}, form({ ...compound, account_type: 'credit' })), /redirect/);
  const write = f.calls.writes[0];
  assert.deepEqual(JSON.parse(JSON.stringify(write.legs)).map(({ accountId, type, amount }) => [accountId, type, amount]), [[20, 'Dr', 40], [30, 'Dr', 60], [10, 'Cr', 100]]);
  assert.equal(write.data.voucherType, 'CRV');
  assert.equal(write.data.paymentType, 'contra_voucher');
  assert.equal(write.data.isApprove, 1);
});

test('unbalanced journals and contra vouchers are rejected', async () => {
  const f = fixture();
  for (const action of [f.storeJournalVoucher, f.storeContraVoucher]) {
    assert.ok((await action({}, form({ ...compound, main_amount: 99 }))).fieldErrors.main_amount);
  }
  assert.equal(f.calls.writes.length, 0);
});

test('compound edits use the correct permission and retain their voucher kind', async () => {
  for (const kind of ['journal', 'contra']) {
    const f = fixture({ existingType: `${kind}_voucher` });
    const action = kind === 'journal' ? f.updateJournalVoucherAction : f.updateContraVoucherAction;
    await assert.rejects(action({}, form({ ...compound, id: 42 })), /redirect/);
    assert.deepEqual(f.calls.permissions, [`${kind}.edit`]);
    assert.equal(f.calls.writes[0].operation, 'update');
    assert.equal(f.calls.writes[0].data.paymentType, `${kind}_voucher`);
  }
});

test('unauthorized voucher mutations never reach persistence', async () => {
  const f = fixture({ denied: true });
  for (const action of [f.storeVoucher, f.updatePaymentVoucher, f.storeJournalVoucher, f.updateJournalVoucherAction, f.storeContraVoucher, f.updateContraVoucherAction]) {
    await assert.rejects(action({}, form({ ...compound, id: 42 })), /forbidden/);
  }
  assert.equal(f.calls.writes.length, 0);
});
