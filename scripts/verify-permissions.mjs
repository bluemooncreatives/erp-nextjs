// Checks the permission names the app guards with.
//
//   node scripts/verify-permissions.mjs            (against lib/routes.ts)
//   DB_HOST=... node scripts/verify-permissions.mjs --db   (also against the
//                                                          permissions table)
//
// `authorize('x')` / `can('x')` deny everyone but system users when `x` is not
// a real route name, and an admin never notices because they bypass the check.
// The authoritative list is the Laravel route names, which `lib/routes.ts`
// mirrors; the `permissions` table is only what a given install has seeded, so
// a name missing there is a seeding question, not a porting bug.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');
const root = process.cwd();

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const used = new Map(); // permission -> files
for (const file of [...walk(path.join(root, 'app')), ...walk(path.join(root, 'lib'))]) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\b(?:authorize|can|canAny|userCan)\(\s*'([^']+)'/g)) {
    const name = match[1];
    if (!used.has(name)) used.set(name, []);
    used.get(name).push(path.relative(root, file));
  }
}

// The navigation table names its permissions as data rather than in a call.
// `requires` is the outer `@if(permissionCheck(...))` a group/leaf is also
// wrapped in, on top of its own `permission` - just as real a guard.
const navigation = readFileSync(path.join(root, 'lib/navigation.ts'), 'utf8');
for (const match of navigation.matchAll(/(?:route|permission|requires):\s*'([^']+)'/g)) {
  const name = match[1];
  if (!used.has(name)) used.set(name, []);
  used.get(name).push('lib/navigation.ts');
}

const routeNames = new Set(
  [...readFileSync(path.join(root, 'lib/routes.ts'), 'utf8').matchAll(/^\s*"([^"]+)":/gm)].map(
    (m) => m[1],
  ),
);

/** The `permission` middleware's rewrites. */
const effective = (name) =>
  name.endsWith('.create')
    ? name.replace(/\.create$/, '.store')
    : name.endsWith('.update')
      ? name.replace(/\.update$/, '.edit')
      : name;

/**
 * Names the PHP checks with `permissionCheck()` that are not route names: the
 * per-module menu gates, the settings tabs, and the `.delete` aliases the
 * seeder created next to `.destroy`. All of these appear in `permissions`.
 */
const NON_ROUTE_PERMISSIONS = new Set([
  'accounts',
  'contact',
  'human_resource',
  'inventory',
  'leave',
  'product',
  'project',
  'purchase',
  'quotation',
  'report',
  'sale',
  'style.index',
  'general_settings.index',
  'invoice_settings.index',
  'email_template.index',
  'sms_template.index',
  'add_product.delete',
  'bank_accounts.delete',
  'currencies.delete',
  'expenses.delete',
  'expenses.show',
  'income.delete',
  'departments.edit',
  'leave_types.edit',
]);

const unknownRoutes = [...used.entries()]
  .filter(([name]) => !NON_ROUTE_PERMISSIONS.has(name))
  .filter(([name]) => !routeNames.has(name) && !routeNames.has(effective(name)))
  .sort(([a], [b]) => a.localeCompare(b));

console.log(
  `${used.size} permission names used; ${unknownRoutes.length} do not match a Laravel route name`,
);
for (const [name, files] of unknownRoutes) {
  console.log(`  ${name}  (${[...new Set(files)].slice(0, 3).join(', ')})`);
}

if (!process.argv.includes('--db')) process.exit(unknownRoutes.length ? 1 : 0);

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'software_erp',
});

const [rows] = await connection.query('select route from permissions');
const known = new Set(rows.map((r) => String(r.route)));

const missing = [...used.entries()]
  .filter(([name]) => !known.has(name) && !known.has(effective(name)))
  .sort(([a], [b]) => a.localeCompare(b));

console.log(
  `database: ${known.size} permissions seeded, ${missing.length} of the names used are not among them`,
);
for (const [name] of missing.slice(0, 20)) console.log(`  not seeded: ${name}`);

await connection.end();
// Only unknown route names are a failure; an unseeded permission is install data.
process.exit(unknownRoutes.length ? 1 : 0);
