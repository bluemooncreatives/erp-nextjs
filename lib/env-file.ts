// ---------------------------------------------------------------------------
// `GeneralSettingsController@overWriteEnvFile` - the Settings screen wrote SMTP
// and SMS gateway credentials straight into the project's `.env`, replacing the
// value of any key already present and leaving the rest of the file untouched.
//
// The same behaviour is kept here, against the Next app's own `.env`. Values are
// also pushed onto `process.env` so the change takes effect for the running
// server without a restart - Laravel re-read the file on the next request.
// ---------------------------------------------------------------------------

import 'server-only';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.join(process.cwd(), '.env');

export async function overwriteEnvFile(
  data: Record<string, string | null | undefined>,
): Promise<boolean> {
  const entries = Object.entries(data).filter(([key]) => key.trim() !== '');
  if (entries.length === 0) return false;
  if (!existsSync(ENV_PATH)) return false;

  const lines = (await readFile(ENV_PATH, 'utf8')).split('\n');

  for (const [key, rawValue] of entries) {
    const value = rawValue ?? '';
    const quoted = /[\s"'#]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
    const index = lines.findIndex((line) => line.split('=', 1)[0] === key);

    if (index >= 0) {
      lines[index] = `${key}=${quoted}`;
    } else {
      lines.push(`${key}=${quoted}`);
    }

    process.env[key] = value;
  }

  await writeFile(ENV_PATH, lines.join('\n'), 'utf8');
  return true;
}

/** Read a key as the Blade forms did with `env('MAIL_HOST')`. */
export function envValue(key: string): string {
  return process.env[key] ?? '';
}
