import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { inflateRawSync } from 'node:zlib';

function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, console, require: (name) => { if (name === 'node:zlib') return { inflateRawSync }; assert.ok(name in modules, name); return modules[name]; } });
  return exports;
}

const sheet = load('lib/import/spreadsheet.ts', { 'server-only': {} });

// The module runs in its own vm realm, so compare plain values, not identities.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('CSV parsing handles quotes, embedded commas and CRLF', () => {
  const rows = sheet.parseCsv('name,note\r\n"Acme, Inc.","said ""hi"""\r\nPlain,\r\n');
  assert.deepEqual(plain(rows), [['name', 'note'], ['Acme, Inc.', 'said "hi"'], ['Plain', '']]);
});

test('records are keyed by the header row and blank rows are skipped', () => {
  const records = sheet.rowsToRecords([['name', 'description'], ['A', 'first'], ['', ''], ['B', '']]);
  assert.deepEqual(plain(records), [{ name: 'A', description: 'first' }, { name: 'B', description: '' }]);
});

test('the shipped sample workbooks read back with their real headers', () => {
  const brands = sheet.parseXlsx(readFileSync('public/uploads/brands.xlsx'));
  assert.deepEqual(plain(brands[0].slice(0, 2)), ['name', 'description']);
  assert.ok(brands.length > 1);

  const products = sheet.parseXlsx(readFileSync('public/uploads/products.xlsx'));
  assert.ok(products[0].length >= 16, `expected 16 product columns, got ${products[0].length}`);
});

test('toCsv quotes only what needs quoting', () => {
  assert.equal(sheet.toCsv([['id', 'name'], [1, 'a,b'], [2, 'q"x']]), 'id,name\n1,"a,b"\n2,"q""x"');
});
