import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Structural audit only: a missing standalone page may be implemented inline
// or as a Server Action. This is not a claim of behavioral migration parity.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = new Map([...readFileSync(path.join(root, 'lib/routes.ts'), 'utf8')
  .matchAll(/^\s*"([^"]+)":\s*'([^']+)'/gm)].map((match) => [match[1], match[2]]));
const navigation = [...readFileSync(path.join(root, 'lib/navigation.ts'), 'utf8')
  .matchAll(/\broute:\s*'([^']+)'/g)].map((match) => match[1]);

function walk(dir, segments = []) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return walk(path.join(dir, entry.name), [...segments, entry.name]);
    if (!/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) return [];
    return ['/' + segments.filter((segment) => !segment.startsWith('(') && !segment.startsWith('@')).join('/')];
  });
}

const pages = walk(path.join(root, 'app'));
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = pages.map((page) => new RegExp('^' + page.split('/').filter(Boolean).map((segment) => {
  if (/^\[\[\.\.\./.test(segment)) return '(?:/.*)?';
  if (/^\[\.\.\./.test(segment)) return '/.+';
  if (/^\[/.test(segment)) return '/[^/]+';
  return '/' + escape(segment);
}).join('') + '/?$'));
const covered = (url) => patterns.some((pattern) => pattern.test(url.replace(/\{\w+\??\}/g, 'example')));
const missingNavigation = navigation.filter((name) => !routes.has(name) || !covered(routes.get(name))).map((name) => ({ name, url: routes.get(name) ?? null }));
const candidates = [...routes].filter(([name, url]) => /\.(index|create|edit|show|history)$/.test(name) && !covered(url)).map(([name, url]) => ({ name, url }));
console.log(JSON.stringify({
  note: 'Structural candidates only; inline forms and Server Actions require manual classification.',
  pageCount: pages.length,
  navigationLinkCount: navigation.length,
  missingNavigation,
  missingScreenCandidates: candidates,
}, null, 2));
