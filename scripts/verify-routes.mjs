// Route parity: every Laravel route against what this port implements.
//
//   node scripts/verify-routes.mjs            summary + unimplemented routes
//   node scripts/verify-routes.mjs --all      also lists what matched
//
// The PHP router is the specification. A GET route is implemented when a page
// answers its URL; a writing route (POST/PUT/PATCH/DELETE) is implemented when
// a server action exists for it. `lib/routes.ts` is the port's own copy of the
// route table, so a route missing from it has certainly not been ported.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const php = path.resolve(root, '..');

// --- The Laravel route table ------------------------------------------------

function routeFiles() {
  const files = [];
  const web = path.join(php, 'routes', 'web.php');
  if (existsSync(web)) files.push(web);

  const modules = path.join(php, 'Modules');
  if (existsSync(modules)) {
    for (const entry of readdirSync(modules)) {
      const routes = path.join(modules, entry, 'Routes', 'web.php');
      if (existsSync(routes)) files.push(routes);
    }
  }
  return files;
}

/**
 * `Route::get('x', 'C@m')->name('n')` and the `Route::resource` shorthand.
 * Group prefixes are not resolved: the port's own route table carries the full
 * paths, and it is the name that identifies a route here.
 */
function parseRoutes(source, file) {
  const found = [];

  const verbs = 'get|post|put|patch|delete|any|match';
  const pattern = new RegExp(
    `Route::(${verbs})\\s*\\(\\s*'([^']*)'\\s*,([^;]*?)\\)\\s*((?:->[^;]*)?);`,
    'gs',
  );

  for (const match of source.matchAll(pattern)) {
    const [, verb, uri, target, chain] = match;
    const name = /->name\(\s*'([^']+)'\s*\)/.exec(chain ?? '')?.[1] ?? null;
    const action = /'([^']*@[^']*)'/.exec(target)?.[1] ?? null;
    found.push({ verb: verb.toUpperCase(), uri, name, action, file });
  }

  for (const match of source.matchAll(
    /Route::resource\s*\(\s*'([^']+)'\s*,\s*'([^']+)'/g,
  )) {
    const [, uri, controller] = match;
    for (const [verb, suffix, method] of [
      ['GET', 'index', 'index'],
      ['GET', 'create', 'create'],
      ['POST', 'store', 'store'],
      ['GET', 'show', 'show'],
      ['GET', 'edit', 'edit'],
      ['PUT', 'update', 'update'],
      ['DELETE', 'destroy', 'destroy'],
    ]) {
      found.push({
        verb,
        uri,
        // Laravel names a resource after its URI with slashes as dots, and the
        // leading slash dropped - `/income` is `income.index`, not `.income.index`.
        name: `${uri.replace(/^\/+|\/+$/g, '').replace(/\//g, '.')}.${suffix}`,
        action: `${controller}@${method}`,
        file,
        fromResource: true,
      });
    }
  }

  return found;
}

const laravelRoutes = routeFiles().flatMap((file) =>
  parseRoutes(readFileSync(file, 'utf8'), path.relative(php, file)),
);

// --- What the port implements ----------------------------------------------

const routesTs = readFileSync(path.join(root, 'lib/routes.ts'), 'utf8');
const portedNames = new Set(
  [...routesTs.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]),
);

function walk(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const appFiles = walk(path.join(root, 'app'));

/** Every page URL the app serves, as a path with `[id]` segments intact. */
const pageUrls = new Set(
  appFiles
    .filter((file) => path.basename(file) === 'page.tsx')
    .map((file) =>
      path
        .relative(path.join(root, 'app'), path.dirname(file))
        .split(path.sep)
        .filter((segment) => !segment.startsWith('(') && !segment.startsWith('_'))
        .join('/'),
    )
    .map((url) => `/${url}`.replace(/\/+$/, '') || '/'),
);

/** Route handlers (`route.ts`) answer URLs too - CSV downloads, callbacks. */
for (const file of appFiles.filter((file) => path.basename(file) === 'route.ts')) {
  const url =
    '/' +
    path
      .relative(path.join(root, 'app'), path.dirname(file))
      .split(path.sep)
      .filter((segment) => !segment.startsWith('(') && !segment.startsWith('_'))
      .join('/');
  pageUrls.add(url);
}

/** Exported server actions, by name, across the app. */
const actionNames = new Set();
for (const file of appFiles) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes("'use server'") && !source.includes('"use server"')) continue;
  for (const match of source.matchAll(/export\s+async\s+function\s+(\w+)/g)) {
    actionNames.add(match[1]);
  }
}

// --- Matching ---------------------------------------------------------------

/** `{id}` in the port's table, `{id}` or `{sale}` in Laravel. */
function normalise(url) {
  return url
    .replace(/^\/+|\/+$/g, '')
    .replace(/\[[^\]]+\]/g, '{}')
    .replace(/\{[^}]*\}/g, '{}')
    .toLowerCase();
}

const portedUrls = new Map();
for (const match of routesTs.matchAll(/^\s*"([^"]+)":\s*'([^']+)'/gm)) {
  portedUrls.set(match[1], match[2]);
}

const servedUrls = new Set([...pageUrls].map(normalise));

const results = laravelRoutes.map((route) => {
  const named = route.name && portedNames.has(route.name);
  const url = route.name ? portedUrls.get(route.name) : null;
  const served = url ? servedUrls.has(normalise(url)) : false;

  // A writing route needs an action, not a page. The port's table still names
  // it, which is what `ROUTES['x.store']` in a form's `action` resolves to.
  const writing = route.verb !== 'GET';

  return { ...route, named, url, served, writing };
});

const unnamed = results.filter((route) => !route.name);
const missingName = results.filter((route) => route.name && !route.named);
const missingPage = results.filter(
  (route) => route.named && !route.writing && !route.served,
);

const byName = new Map();
for (const route of results) {
  if (route.name) byName.set(route.name, route);
}

console.log(
  `laravel routes: ${results.length} (${byName.size} named) in ${routeFiles().length} files`,
);
console.log(`port route table: ${portedNames.size} names, ${pageUrls.size} page urls`);
console.log(`server actions: ${actionNames.size}`);
console.log('');
console.log(`named routes absent from lib/routes.ts: ${missingName.length}`);
for (const route of missingName) {
  console.log(`  ${route.verb.padEnd(6)} ${route.name}  (${route.action ?? '-'})  ${route.file}`);
}

console.log('');
console.log(`GET routes with no page serving their url: ${missingPage.length}`);
for (const route of missingPage) {
  console.log(`  ${route.name.padEnd(42)} ${route.url}  ${route.file}`);
}

if (process.argv.includes('--all')) {
  console.log('');
  console.log(`routes with no name in the PHP router: ${unnamed.length}`);
  for (const route of unnamed) {
    console.log(`  ${route.verb.padEnd(6)} ${route.uri}  (${route.action ?? '-'})  ${route.file}`);
  }
}

const gaps = missingName.length + missingPage.length;
console.log('');
console.log(gaps === 0 ? 'no gaps found' : `${gaps} routes to review`);
