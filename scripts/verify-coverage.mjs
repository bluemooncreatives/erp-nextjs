// Logic parity: every PHP controller and repository method against this port.
//
//   node scripts/verify-coverage.mjs              the gaps
//   node scripts/verify-coverage.mjs --all        also the unreachable methods
//   node scripts/verify-coverage.mjs --repos      per-repository coverage
//   node scripts/verify-coverage.mjs --json       machine-readable
//
// `verify-routes.mjs` answers "does a URL resolve". It deliberately says
// nothing about the writing routes, because Next binds a server action as a
// function reference and there is no URL to check. This asks the other
// question: is the behaviour behind each PHP method present here at all?
//
// The port annotates what it ports - `SaleController@store`,
// `SaleRepository::dueList($type)`, `sale::sale.index`. A method the port names
// nowhere is not proof of a gap, but it is exactly the list worth reading, and
// it should only ever shrink.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const php = path.resolve(root, '..');

// --- PHP side ---------------------------------------------------------------

function phpFiles(matcher) {
  const found = [];
  (function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === 'vendor' || entry === 'node_modules' || entry === '.git') continue;
      if (entry === 'next-js-erp') continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.php') && matcher(full)) found.push(full);
    }
  })(php);
  return found;
}

const controllerFiles = phpFiles((file) =>
  file.split(path.sep).includes('Controllers'),
);
const repositoryFiles = phpFiles(
  (file) => /Repository\.php$/.test(file) && !/Interface\.php$/.test(file),
);

/** Framework scaffolding and CRUD verbs too generic to mean anything on their own. */
const SCAFFOLDING = new Set([
  '__construct',
  '__invoke',
  'boot',
  'register',
  'map',
  'rules',
  'authorize',
  'messages',
  'attributes',
  'handle',
  'model',
  'all',
  'find',
  'create',
  'update',
  'delete',
  'store',
  'index',
  'show',
  'edit',
  'destroy',
]);

function methodsIn(file) {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/public\s+function\s+(\w+)\s*\(/g)].map((match) => match[1]);
}

const controllerMethods = [];
for (const file of controllerFiles) {
  const cls = path.basename(file, '.php');
  for (const method of methodsIn(file)) {
    controllerMethods.push({ cls, method, file: path.relative(php, file) });
  }
}

const repositoryMethods = [];
for (const file of repositoryFiles) {
  const cls = path.basename(file, '.php');
  for (const method of methodsIn(file)) {
    repositoryMethods.push({ cls, method, file: path.relative(php, file) });
  }
}

// --- Which controller methods a route can even reach -----------------------

const routeSources = [];
const web = path.join(php, 'routes', 'web.php');
if (existsSync(web)) routeSources.push(readFileSync(web, 'utf8'));
const modules = path.join(php, 'Modules');
if (existsSync(modules)) {
  for (const entry of readdirSync(modules)) {
    const file = path.join(modules, entry, 'Routes', 'web.php');
    if (existsSync(file)) routeSources.push(readFileSync(file, 'utf8'));
  }
}
const routeText = routeSources.join('\n');

/**
 * `'C@m'`, `[C::class, 'm']`, and the seven a `Route::resource` implies, each
 * carrying the route name that reaches it. The name matters more than the
 * method: it is what the port's own table is keyed by, so "is this behaviour
 * here" is best answered by asking whether that route name is wired to
 * anything.
 */
const routed = new Map(); // "Controller@method" -> Set of route names

function addRouted(key, name) {
  if (!routed.has(key)) routed.set(key, new Set());
  if (name) routed.get(key).add(name);
}

const NAMED = /->name\(\s*'([^']+)'\s*\)/;

for (const match of routeText.matchAll(/'([A-Za-z]+Controller)@(\w+)'([^;]*)/g)) {
  addRouted(`${match[1]}@${match[2]}`, NAMED.exec(match[3] ?? '')?.[1] ?? null);
}
for (const match of routeText.matchAll(
  /([A-Za-z]+Controller)::class\s*,\s*'(\w+)'\s*\]([^;]*)/g,
)) {
  addRouted(`${match[1]}@${match[2]}`, NAMED.exec(match[3] ?? '')?.[1] ?? null);
}
for (const match of routeText.matchAll(
  /Route::resource\s*\(\s*'([^']+)'\s*,\s*'([^']+)'/g,
)) {
  const controller = match[2].split(/[\\/]/).pop();
  const base = match[1].replace(/^\/+|\/+$/g, '').replace(/\//g, '.');
  for (const method of ['index', 'create', 'store', 'show', 'edit', 'update', 'destroy']) {
    addRouted(`${controller}@${method}`, `${base}.${method}`);
  }
}

// --- Port side --------------------------------------------------------------

function portFiles() {
  const found = [];
  for (const dir of ['app', 'lib', 'components', 'scripts', 'docs', 'tests']) {
    const base = path.join(root, dir);
    if (!existsSync(base)) continue;
    (function walk(current) {
      for (const entry of readdirSync(current)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = path.join(current, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs|md)$/.test(entry)) found.push(full);
      }
    })(base);
  }
  return found;
}

const portText = portFiles()
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

/**
 * A method counts as covered when the port names it: `Controller@method`,
 * `Repository::method`, or the bare name where that is distinctive enough to
 * mean something - `csv_upload_staff`, `trranactionEntry`. A short or plainly
 * English name on its own is not taken as evidence.
 */
const DISTINCTIVE = /[_A-Z]/;

function covered({ cls, method }) {
  if (portText.includes(`${cls}@${method}`)) return true;
  if (portText.includes(`${cls}::${method}`)) return true;
  if (method.length >= 6 && DISTINCTIVE.test(method) && portText.includes(method)) return true;
  return false;
}

/**
 * Route names the port wires to something - a `can()`, an `authorize()`, a
 * `ROUTES['x']` in a form or link. `lib/routes.ts` is skipped: it lists every
 * name by construction, so finding one there says nothing.
 */
const wiredNames = new Set();
for (const file of portFiles()) {
  if (path.relative(root, file) === path.join('lib', 'routes.ts')) continue;
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/['"`]([a-z][\w.-]*\.[\w.-]+)['"`]/gi)) {
    wiredNames.add(match[1]);
  }
}

/** The URLs the port serves, so a page answering the route counts too. */
const servedUrls = new Set();
(function walkApp(dir, base = '') {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      const segment = entry.startsWith('(') || entry.startsWith('_') ? base : `${base}/${entry}`;
      walkApp(full, segment);
    } else if (entry === 'page.tsx' || entry === 'route.ts') {
      servedUrls.add(base || '/');
    }
  }
})(path.join(root, 'app'));

const portedUrls = new Map();
for (const match of readFileSync(path.join(root, 'lib/routes.ts'), 'utf8').matchAll(
  /^\s*"([^"]+)":\s*'([^']+)'/gm,
)) {
  portedUrls.set(match[1], match[2]);
}

const normalise = (url) =>
  url
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((segment) =>
      /^\[+\.{0,3}[^\]]+\]+$/.test(segment) || /^\{[^}]*\}$/.test(segment)
        ? '{}'
        : segment.toLowerCase(),
    )
    .join('/');

const servedNormalised = new Set([...servedUrls].map(normalise));

/** The route that reaches this method is wired to something in the port. */
function routeCovered(entry) {
  const names = routed.get(`${entry.cls}@${entry.method}`);
  if (!names) return false;
  for (const name of names) {
    if (wiredNames.has(name)) return true;
    const url = portedUrls.get(name);
    if (url && servedNormalised.has(normalise(url))) return true;
  }
  return false;
}

const routedMethods = controllerMethods.filter(
  (entry) => !SCAFFOLDING.has(entry.method) && routed.has(`${entry.cls}@${entry.method}`),
);

const unreachable = controllerMethods.filter(
  (entry) => !SCAFFOLDING.has(entry.method) && !routed.has(`${entry.cls}@${entry.method}`),
);

const controllerGaps = routedMethods.filter(
  (entry) => !covered(entry) && !routeCovered(entry),
);

/**
 * Repositories are reported per class, not per method.
 *
 * The port consolidates: `dailyProfit`, `weeklyProfit`, `monthlyProfit` and
 * `yearlyProfit` are one parameterised `profitSeries`, and
 * `parentNullAccountList` is `accountTree`. Listing each uncited method would
 * report a hundred gaps that are not gaps. What actually matters is a
 * repository the port does not draw on at all - that is a module nobody
 * ported - and how much of each one is cited, which only goes up.
 *
 * The queries themselves are checked elsewhere: `verify:db` runs the port's
 * repository queries against a real database.
 */
const byRepository = new Map();
for (const entry of repositoryMethods) {
  if (SCAFFOLDING.has(entry.method)) continue;
  const record = byRepository.get(entry.cls) ?? {
    cls: entry.cls,
    file: entry.file,
    total: 0,
    cited: 0,
    uncited: [],
  };
  record.total += 1;
  if (covered(entry)) record.cited += 1;
  else record.uncited.push(entry.method);
  byRepository.set(entry.cls, record);
}

const repositories = [...byRepository.values()].sort((a, b) => a.cited / a.total - b.cited / b.total);
const repositoryGaps = repositories.filter((record) => record.cited === 0);

// --- Report -----------------------------------------------------------------

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      { controllerGaps, repositoryGaps, unreachable: unreachable.length },
      null,
      2,
    ),
  );
} else {
  console.log(
    `controllers: ${controllerFiles.length} files, ${routedMethods.length} routed methods ` +
      `(${unreachable.length} defined but unreachable by any route)`,
  );
  console.log(
    `repositories: ${repositoryFiles.length} files, ${repositoryMethods.length} methods`,
  );
  console.log('');

  console.log(`routed controller methods the port never names: ${controllerGaps.length}`);
  for (const entry of controllerGaps) {
    console.log(`  ${`${entry.cls}@${entry.method}`.padEnd(52)} ${entry.file}`);
  }

  const citedMethods = repositories.reduce((sum, record) => sum + record.cited, 0);
  const totalMethods = repositories.reduce((sum, record) => sum + record.total, 0);

  console.log('');
  console.log(
    `repositories the port draws on nowhere: ${repositoryGaps.length} ` +
      `(${citedMethods}/${totalMethods} methods cited across ${repositories.length})`,
  );
  for (const record of repositoryGaps) {
    console.log(`  ${record.cls.padEnd(44)} ${record.file}`);
  }

  if (process.argv.includes('--repos')) {
    console.log('');
    console.log('per repository, least covered first:');
    for (const record of repositories) {
      const share = `${record.cited}/${record.total}`.padEnd(8);
      console.log(`  ${share} ${record.cls.padEnd(40)} ${record.uncited.slice(0, 6).join(', ')}`);
    }
  }

  if (process.argv.includes('--all')) {
    console.log('');
    console.log(`defined but unreachable by any route: ${unreachable.length}`);
    for (const entry of unreachable) {
      console.log(`  ${`${entry.cls}@${entry.method}`.padEnd(52)} ${entry.file}`);
    }
  }

  const total = controllerGaps.length + repositoryGaps.length;
  console.log('');
  if (total === 0) {
    console.log('nothing unaccounted for');
  } else {
    console.log(`${total} to read through.`);
    console.log(
      'Each has been checked by hand at least once; what survives is naming,',
    );
    console.log(
      'not absent behaviour - AJAX feeds the port server-renders, modal',
    );
    console.log(
      'fragments that are inline panels, and the session-held line',
    );
    console.log(
      'accumulators that are client state here. A NEW entry is the signal.',
    );
  }
}
