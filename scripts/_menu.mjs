import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const php = path.resolve(root, '..');

const menuFiles = [];
const modules = path.join(php, 'Modules');
for (const entry of readdirSync(modules)) {
  const file = path.join(modules, entry, 'Resources', 'views', 'menu.blade.php');
  if (existsSync(file)) menuFiles.push(file);
}
const main = path.join(php, 'resources', 'views', 'backEnd', 'partials', 'menu.blade.php');
if (existsSync(main)) menuFiles.push(main);

const menuRoutes = new Map(); // name -> file
for (const file of menuFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/route\('([^']+)'/g)) {
    if (!menuRoutes.has(match[1])) menuRoutes.set(match[1], path.relative(php, file));
  }
}

const nav = readFileSync(path.join(root, 'lib/navigation.ts'), 'utf8');
const navRoutes = new Set(
  [...nav.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]),
);

// Header, dropdown and form targets are not sidebar entries in either app.
const CHROME = new Set([
  'logout',
  'change_password',
  'language.change',
  'change.showroom',
  'menu.search',
  'notification.update',
  'mark_notifications',
  'all_notifications',
  'profile_view',
  'contact.profile',
  'company_info',
]);

const missing = [];
for (const [name, file] of menuRoutes) {
  if (navRoutes.has(name) || CHROME.has(name)) continue;
  missing.push({ name, file });
}

console.log(`menu routes in the PHP: ${menuRoutes.size}, in the port's navigation: ${navRoutes.size}`);
console.log('');
console.log(`menu entries with no matching navigation route: ${missing.length}`);
for (const entry of missing) {
  console.log(`  ${entry.name.padEnd(36)} ${entry.file}`);
}
