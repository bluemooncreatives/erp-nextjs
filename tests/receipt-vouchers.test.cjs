const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Exercise the real Server Action with isolated persistence and auth boundaries.
// These tests do not connect to or modify the ERP database.
const filename = path.join(__dirname, '../app/(dashboard)/account/voucher/recieve/actions.ts');
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture({ approved = false, existing = { paymentType: 'voucher_recieve' }, denied = false } = {}) {
  const calls = { permissions: [], writes: [], invalidations: [] };
  const modules = {
    'next/cache': { revalidatePath: (url) => calls.invalidations.push(url) },
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    '@/lib/auth/permissions': { authorize: async (permission) => {
      calls.permissions.push(permission);
      if (denied) throw new Error('forbidden');
      return { id: 7 };
    } },
    '@/lib/accounting/accounts': {
      receiveFromAccounts: async () => [{ id: 10 }],
      receiveByAccounts: async () => [{ id: 20, configurationGroupId: 1 }, { id: 30, configurationGroupId: 2 }],
    },
    '@/lib/accounting/vouchers': {
      createVoucher: async (data) => calls.writes.push({ operation: 'create', data }),
      updateVoucher: async (id, data) => calls.writes.push({ operation: 'update', id, data }),
      findVoucher: async () => existing,
    },
    '@/lib/accounting/receipts': { receiptInvoiceOptions: async (account) => account === 10 ? [{ value: 99, label: 'INV-99' }] : [] },
    '@/lib/business-settings': { isEnabled: async (key) => { assert.equal(key, 'voucher_recieve_approval'); return approved; } },
    '@/lib/db/morph': { MorphType: { Sale: 'Modules\\Sale\\Entities\\Sale' } },
    '@/lib/activity-log': { successLog: async () => {}, errorLog: async () => {} },
    '@/lib/routes': { ROUTES: { 'voucher_recieve.index': '/account/voucher/recieve' } },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } }, { filename });
  return { ...exports, calls };
}

function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ date: '2026-09-12', credit_account_id: '10', debit_account_id: '20', debit_account_amount: '125.50', ...values })) data.set(key, value);
  return data;
}

test('cash receipt debits cash, credits the payer, and ignores a forged approval flag', async () => {
  const f = fixture();
  await assert.rejects(f.saveReceiptVoucher({}, form({ is_approve: '1', invoice_id: '99' })), /redirect:/);
  const data = f.calls.writes[0].data;
  assert.equal(data.debitAccountId, 20);
  assert.equal(data.creditAccountId, 10);
  assert.equal(data.amount, 125.5);
  assert.equal(data.voucherType, 'CV');
  assert.equal(data.isApprove, 0);
  assert.equal(data.referableId, 99);
  assert.equal(data.referableType, 'Modules\\Sale\\Entities\\Sale');
  assert.deepEqual(f.calls.permissions, ['voucher_recieve.store']);
});

test('bank account determines voucher type and retains cheque details', async () => {
  const f = fixture({ approved: true });
  await assert.rejects(f.saveReceiptVoucher({}, form({ debit_account_id: '30', voucher_type: 'CV', cheque_no: 'CH-123', cheque_date: '2026-09-12', bank_name: 'Bank', bank_branch: 'Branch' })), /redirect:/);
  const data = f.calls.writes[0].data;
  assert.equal(data.voucherType, 'BV');
  assert.equal(data.chequeNo, 'CH-123');
  assert.equal(data.bankName, 'Bank');
  assert.equal(data.isApprove, 1);
});

test('invoice belonging to another payer cannot be linked', async () => {
  const f = fixture();
  const result = await f.saveReceiptVoucher({}, form({ invoice_id: '123' }));
  assert.ok(result.fieldErrors.invoice_id);
  assert.equal(f.calls.writes.length, 0);
});

test('invalid accounts and nonfinite amounts cannot reach persistence', async () => {
  const f = fixture();
  for (const [key, value] of [['debit_account_id', '99'], ['credit_account_id', '99'], ['debit_account_amount', 'NaN'], ['debit_account_amount', 'Infinity'], ['debit_account_amount', '-1']]) {
    assert.ok((await f.saveReceiptVoucher({}, form({ [key]: value }))).fieldErrors[key]);
  }
  assert.equal(f.calls.writes.length, 0);
});

test('edit requires edit permission and cannot target a payment voucher', async () => {
  const f = fixture({ existing: { paymentType: 'voucher_payment' } });
  assert.equal((await f.saveReceiptVoucher({}, form({ id: '42' }))).error, 'Receipt voucher not found.');
  assert.deepEqual(f.calls.permissions, ['voucher_recieve.edit']);
  assert.equal(f.calls.writes.length, 0);
});

test('receipt edits call the update repository and refresh voucher screens', async () => {
  const f = fixture();
  await assert.rejects(f.saveReceiptVoucher({}, form({ id: '42' })), /redirect:/);
  assert.equal(f.calls.writes[0].operation, 'update');
  assert.equal(f.calls.writes[0].id, 42);
  assert.ok(f.calls.invalidations.includes('/account/voucher/recieve'));
});

test('denied users cannot save or fetch invoice options', async () => {
  const f = fixture({ denied: true });
  await assert.rejects(f.saveReceiptVoucher({}, form()), /forbidden/);
  await assert.rejects(f.loadReceiptInvoices(10), /forbidden/);
  assert.equal(f.calls.writes.length, 0);
});

test('invoice lookup rejects accounts outside the receipt account list', async () => {
  const f = fixture();
  assert.equal((await f.loadReceiptInvoices(99)).length, 0);
  assert.equal((await f.loadReceiptInvoices(10))[0].value, 99);
});
