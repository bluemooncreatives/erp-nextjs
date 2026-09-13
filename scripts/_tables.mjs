import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const schemaPath = path.join('lib', 'db', 'schema.ts');
const schema = readFileSync(schemaPath, 'utf8');
const tables = [...schema.matchAll(/export const (\w+) = mysqlTable\('([^']+)'/g)].map(
  (m) => ({ sym: m[1], table: m[2] }),
);

const files = [];
for (const root of ['lib', 'app', 'components']) {
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && full !== schemaPath) files.push(full);
    }
  })(root);
}

const text = files.map((f) => readFileSync(f, 'utf8')).join('\n');
console.log('files scanned:', files.length);

const unused = tables.filter((t) => !new RegExp(`\\b${t.sym}\\b`).test(text));
console.log(`tables: ${tables.length}, never referenced outside schema.ts: ${unused.length}`);
for (const u of unused) console.log('  ', u.table.padEnd(38), u.sym);
