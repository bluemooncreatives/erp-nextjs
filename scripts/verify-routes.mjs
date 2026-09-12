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
 * `->name('x.')->group(...)` nests, and every name inside the group is prefixed
 * with it - `Route::resource('roles', ...)` under `Route::name('permission.')`
 * is `permission.roles.index`, which is what the port's table calls it. The
 * name can be chained after anything (`Route::prefix('stripe')->name('stripe.')`),
 * so what marks a group is the `->group` that follows. This tracks the prefix
 * by brace depth; URI prefixes are not resolved, because it is the name that
 * identifies a route here.
 */
function namePrefixAt(source, offset) {
  const prefixes = [];
  let depth = 0;

  // Walk the source up to `offset`, recording the depth each `name(...)` group
  // opened at so it can be dropped when that brace closes.
  const tokens = source
    .slice(0, offset)
    .matchAll(/(?:::|->)name\(\s*'([^']*)'\s*\)\s*->group|\{|\}/g);
  for (const token of tokens) {
    if (token[0] === '{') depth += 1;
    else if (token[0] === '}') {
      depth -= 1;
      while (prefixes.length && prefixes[prefixes.length - 1].depth > depth) prefixes.pop();
    } else {
      // The group's brace has not been seen yet, so it opens at depth + 1.
      prefixes.push({ name: token[1], depth: depth + 1 });
    }
  }

  return prefixes.map((entry) => entry.name).join('');
}

/** `Route::get('x', 'C@m')->name('n')` and the `Route::resource` shorthand. */
function parseRoutes(source, file) {
  const found = [];

  const verbs = 'get|post|put|patch|delete|any|match';
  const pattern = new RegExp(
    `Route::(${verbs})\\s*\\(\\s*'([^']*)'\\s*,([^;]*?)\\)\\s*((?:->[^;]*)?);`,
    'gs',
  );

  for (const match of source.matchAll(pattern)) {
    const [, verb, uri, target, chain] = match;
    const own = /->name\(\s*'([^']+)'\s*\)/.exec(chain ?? '')?.[1] ?? null;
    const action = /'([^']*@[^']*)'/.exec(target)?.[1] ?? null;
    const name = own === null ? null : namePrefixAt(source, match.index) + own;
    found.push({ verb: verb.toUpperCase(), uri, name, action, file });
  }

  for (const match of source.matchAll(
    /Route::resource\s*\(\s*'([^']+)'\s*,\s*'([^']+)'/g,
  )) {
    const [, uri, controller] = match;
    const prefix = namePrefixAt(source, match.index);
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
        name: `${prefix}${uri.replace(/^\/+|\/+$/g, '').replace(/\//g, '.')}.${suffix}`,
        action: `${controller}@${method}`,
        file,
        fromResource: true,
      });
    }
  }

  return found;
}

/**
 * Commented-out routes are not routes. The Stripe module's whole route file is
 * inside one block comment, and reading it would report the port's Stripe
 * screens as answering routes the source does not serve. Replacing comments
 * with spaces rather than deleting them keeps every match offset aligned with
 * the original source, which `namePrefixAt` relies on.
 */
function stripPhpComments(source) {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*/g,
    (comment) => comment.replace(/[^\n]/g, ' '),
  );
}

const laravelRoutes = routeFiles().flatMap((file) =>
  parseRoutes(stripPhpComments(readFileSync(file, 'utf8')), path.relative(php, file)),
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

// --- Does the PHP controller method exist? ---------------------------------

/**
 * Several routes in the source point at a method no controller defines - the
 * route 500s in Laravel too. Those are dead in the source, not gaps here, so
 * they are reported apart from the screens that still need porting.
 */
const controllerCache = new Map();

function controllerSource(controller) {
  if (controllerCache.has(controller)) return controllerCache.get(controller);

  const base = controller.split(/[\\/]/).pop();
  const candidates = [];
  const modules = path.join(php, 'Modules');
  if (existsSync(modules)) {
    for (const entry of readdirSync(modules)) {
      candidates.push(path.join(modules, entry, 'Http', 'Controllers', `${base}.php`));
    }
  }
  candidates.push(path.join(php, 'app', 'Http', 'Controllers', `${base}.php`));

  const file = candidates.find((candidate) => existsSync(candidate));
  const source = file ? readFileSync(file, 'utf8') : null;
  controllerCache.set(controller, source);
  return source;
}

/** true / false, or null when there is nothing to check against. */
function methodExists(action) {
  if (!action || !action.includes('@')) return null;
  const [controller, method] = action.split('@');
  const source = controllerSource(controller);
  if (source == null) return null;
  return new RegExp(String.raw`function\s+${method}\s*\(`).test(source);
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

/**
 * Not every GET route was a page. Checking the rest for a page url is noise:
 *   - destructive and state-changing GETs, which Laravel guarded with a modal
 *     and a confirm and which are server actions here
 *   - `.search` / `search_index`, which are query parameters on the index page
 *   - `get_list` / `.all` / `getdata` / suggestion endpoints, which were jQuery
 *     AJAX feeds and are server-rendered data or a route handler here
 */
const ACTION_SHAPED =
  /(^|\.)(destroy\d*|delete|remove|approve|status|sent|send|receive|clone|copy|default|add\.stock|complete|read|mail|send_mail)($|\.)/;
const FEED_SHAPED = /(get_list|getdata|_all$|\.all$|suggestion|^team-user$|^project-user$)/;
const SEARCH_SHAPED = /(\.search$|\.search_index$|search$|_search$|\.daily_search$)/;

function classify(route) {
  if (route.verb !== 'GET') return 'write';
  if (ACTION_SHAPED.test(route.name)) return 'action';
  if (SEARCH_SHAPED.test(route.name)) return 'search';
  if (FEED_SHAPED.test(route.name)) return 'feed';
  return 'page';
}

const results = laravelRoutes.map((route) => {
  const named = Boolean(route.name) && portedNames.has(route.name);
  const url = route.name ? portedUrls.get(route.name) : null;
  const served = url ? servedUrls.has(normalise(url)) : false;
  const kind = route.name ? classify(route) : 'unnamed';
  return { ...route, named, url, served, kind };
});

const unnamed = results.filter((route) => !route.name);
const missingName = results.filter((route) => route.name && !route.named);

/**
 * A page route is implemented when a page answers its url. A link elsewhere
 * naming the route proves nothing - a link to a url nothing serves is exactly
 * the bug this looks for. Writing routes are not checked: Next binds a server
 * action as a function reference, so there is no name to look for, and their
 * coverage is what `verify:actions` measures by posting real forms.
 */
const pageGaps = results.filter(
  (route) => route.named && route.kind === 'page' && !route.served,
);

const dead = [];
const missingPage = [];
for (const route of pageGaps) {
  (methodExists(route.action) === false ? dead : missingPage).push(route);
}

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
console.log(`dead in the source (no such controller method): ${dead.length}`);
for (const route of dead) {
  console.log(`  ${route.name.padEnd(42)} ${route.action}`);
}

console.log('');
console.log(`page routes with no page serving their url: ${missingPage.length}`);
for (const route of missingPage) {
  console.log(`  ${route.name.padEnd(42)} ${route.url}  ${route.action ?? '-'}`);
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
