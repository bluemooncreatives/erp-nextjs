import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import crypto from 'node:crypto';

function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, console, URL, URLSearchParams, Date, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
  return exports;
}

test('signed verification links only validate untouched, unexpired URLs', () => {
  process.env.APP_KEY = 'test-key';
  const signing = load('lib/auth/signed-url.ts', {
    'server-only': {},
    'node:crypto': crypto,
    '@/lib/config': { config: { app: { key: 'test-key', url: 'https://erp.example' } } },
  });

  const url = new URL(signing.temporarySignedUrl('https://erp.example', '/email/verify/7/abc', 60));
  assert.ok(signing.hasValidSignature(url.pathname, url.searchParams));

  const tampered = new URL(url);
  tampered.searchParams.set('expires', String(Number(tampered.searchParams.get('expires')) + 60));
  assert.equal(signing.hasValidSignature(tampered.pathname, tampered.searchParams), false);

  const expired = new URL(signing.temporarySignedUrl('https://erp.example', '/email/verify/7/abc', -1));
  assert.equal(signing.hasValidSignature(expired.pathname, expired.searchParams), false);

  assert.equal(signing.hasValidSignature('/email/verify/8/abc', url.searchParams), false);
});
