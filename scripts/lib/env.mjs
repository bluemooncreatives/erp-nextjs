// Loads the project's .env files the way `next dev` does, so the verification
// scripts talk to the same database and sign session cookies with the same
// secret as the app they are checking.
//
// Without this a sweep quietly runs signed out: every page answers 307 to the
// login screen and the run still reports "no failures".
//
// Precedence matches Next: the real environment wins, then .env.local, then
// .env. Values already exported by the caller are never overwritten, so
// `DB_PORT=3307 node scripts/...` still points at a scratch database.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

function parse(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function loadEnv(root = process.cwd()) {
  for (const file of ['.env.local', '.env']) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const [key, value] of Object.entries(parse(readFileSync(full, 'utf8')))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

/** Fails loudly rather than letting a sweep run signed out. */
export function requireSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(
      'SESSION_SECRET is not set (checked the environment, .env.local and .env).\n' +
        'Cookies signed with a different secret are rejected and every page\n' +
        'redirects to /login, which would make this run meaningless.',
    );
    process.exit(2);
  }
  return secret;
}
