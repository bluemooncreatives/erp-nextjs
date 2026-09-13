import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
  return exports;
}

function themeFixture() {
  const themes = { id: 'id', isDefault: 'isDefault' };
  const colorTheme = { themeId: 'themeId' };
  const colors = { id: 'id' };
  const data = new Map([[themes, [{ id: 1, title: 'System', isDefault: 0, createdBy: 1 }, { id: 2, title: 'Custom', isDefault: 1, createdBy: 1 }]], [colorTheme, [{ themeId: 2, colorId: 10, value: '#123456' }]], [colors, []]]);
  const matches = (row, condition) => !condition || row[condition[0]] === condition[1];
  const db = {
    select: () => ({ from: (table) => {
      let condition;
      const query = { where: (value) => { condition = value; return query; }, orderBy: () => query, limit: () => query, then: (resolve, reject) => Promise.resolve(data.get(table).filter((row) => matches(row, condition)).map((row) => ({ ...row }))).then(resolve, reject) };
      return query;
    } }),
    insert: (table) => ({ values: async (values) => {
      const rows = data.get(table);
      const id = Math.max(0, ...rows.map((row) => row.id ?? 0)) + 1;
      rows.push(...(Array.isArray(values) ? values : [{ ...values, id }]));
      return [{ insertId: id }];
    } }),
    update: (table) => ({ set: (values) => ({ where: async (condition) => { for (const row of data.get(table)) if (matches(row, condition)) Object.assign(row, values); } }) }),
    delete: (table) => ({ where: async (condition) => data.set(table, data.get(table).filter((row) => !matches(row, condition))) }),
  };
  const repository = load('lib/setting/themes.ts', { 'server-only': {}, 'drizzle-orm': { eq: (a, b) => [a, b] }, '@/lib/db/client': { db, transaction: async (fn) => {
    const snapshot = [...data].map(([key, values]) => [key, structuredClone(values)]);
    try { return await fn(db); } catch (error) { for (const [key, values] of snapshot) data.set(key, values); throw error; }
  } }, '@/lib/db/schema': { themes, colorTheme, colors } });
  return { ...repository, themes: () => data.get(themes), palette: () => data.get(colorTheme) };
}

test('deleting the active custom theme restores the system default and removes its palette', async () => {
  const f = themeFixture();
  await f.changeTheme(2, 'delete', 7);
  assert.equal(f.themes().length, 1);
  assert.equal(f.themes()[0].isDefault, 1);
  assert.equal(f.palette().length, 0);
});
test('system theme deletion is rejected without changing defaults', async () => {
  const f = themeFixture();
  await assert.rejects(f.changeTheme(1, 'delete', 7), /cannot be deleted/);
  assert.equal(f.themes().find((theme) => theme.id === 2).isDefault, 1);
});
test('theme clones retain palette values without becoming the default', async () => {
  const f = themeFixture();
  await f.changeTheme(2, 'copy', 7);
  const clone = f.themes().at(-1);
  assert.equal(clone.title, 'Clone of Custom');
  assert.equal(clone.createdBy, 7);
  assert.equal(clone.isDefault, 0);
  assert.equal(f.palette().find((color) => color.themeId === clone.id).value, '#123456');
});
test('setting a default leaves exactly one default theme', async () => {
  const f = themeFixture();
  await f.changeTheme(1, 'default', 7);
  assert.deepEqual(f.themes().filter((theme) => theme.isDefault).map((theme) => theme.id), [1]);
});
test('theme edits retain original creator and default flag while replacing colors', async () => {
  const f = themeFixture();
  await f.saveTheme(2, { title: 'Changed', isDefault: 0, createdBy: 7 }, [{ colorId: 10, value: '#abcdef' }]);
  assert.equal(f.themes()[1].isDefault, 1);
  assert.equal(f.themes()[1].createdBy, 1);
  assert.equal(f.palette()[0].value, '#abcdef');
});

test('theme style normalizes legacy image paths and rejects invalid palette strings', () => {
  const { themeStyle } = load('lib/setting/theme-style.ts');
  const style = themeStyle({ colorMode: 'solid', backgroundType: 'image', backgroundColor: '#ffffff', backgroundImage: '/public/backEnd/img/body-bg.jpg' }, [{ name: 'base_color', value: '#123456' }, { name: 'text-color', value: '</style><script>' }]);
  assert.equal(style.backgroundImage, 'url("/backEnd/img/body-bg.jpg")');
  assert.equal(style['--color-brand-500'], '#123456');
  assert.equal(style['--erp-text-color'], undefined);
});

function leaveFixture() {
  const updates = [];
  const rows = [{ id: 1, staffId: 11, entitlement: 20 }, { id: 2, staffId: 22, entitlement: 20 }, { id: 3, staffId: 33, entitlement: -2 }, { id: 4, staffId: null, entitlement: 9 }];
  const query = { from: () => query, leftJoin: () => query, orderBy: async () => rows };
  const db = { select: () => query, update: () => ({ set: (values) => ({ where: async (condition) => updates.push({ id: condition[1], values }) }) }) };
  const repository = load('lib/hr/carry-forward.ts', { 'server-only': {}, 'drizzle-orm': { eq: (a, b) => [a, b], desc: (a) => a, sql: () => ({}) }, '@/lib/db/client': { db, transaction: async (fn) => fn(db) }, '@/lib/db/schema': { users: {}, roles: {}, staffs: {} } });
  return { ...repository, updates };
}
test('carry-forward generation excludes user IDs 1 and 2 and preserves negative balances and activation status', async () => {
  const f = leaveFixture();
  await f.generateCarryForward();
  assert.equal(f.updates.length, 1);
  assert.equal(f.updates[0].id, 33);
  assert.equal(f.updates[0].values.carryForward, -2);
  assert.equal(f.updates[0].values.isCarryActive, undefined);
});
test('carry-forward toggles use the staff ID and compute the balance on the server', async () => {
  const f = leaveFixture();
  await f.setCarryForward(33, true);
  await f.setCarryForward(33, false);
  assert.equal(f.updates[0].values.carryForward, -2);
  assert.equal(f.updates[1].values.carryForward, 0);
  assert.equal(f.updates[1].values.isCarryActive, 0);
  await assert.rejects(f.setCarryForward(3, true), /not found/);
});

// `payroll_earn_deducs.earn_dedc_type` is the letter 'E' or 'D' - the payroll
// reports filter on exactly that, so a longer spelling makes rows invisible.
const payrollLines = load('lib/hr/payroll-lines.ts');

test('an earnings line is recognised however the form spelt it', () => {
  for (const spelling of ['E', 'e', 'earn', 'Earning', ' E ']) {
    assert.equal(payrollLines.isEarningLine(spelling), true, spelling);
  }
});

test('a deduction line is never mistaken for an earning', () => {
  for (const spelling of ['D', 'd', 'dedc', 'Deduction', '', null, undefined]) {
    assert.equal(payrollLines.isEarningLine(spelling), false, String(spelling));
  }
});

test('the stored kinds are the single letters Laravel writes', () => {
  assert.equal(payrollLines.PayrollLineKind.Earning, 'E');
  assert.equal(payrollLines.PayrollLineKind.Deduction, 'D');
});
