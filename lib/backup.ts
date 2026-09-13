// ---------------------------------------------------------------------------
// Database backups - port of Modules/Backup's BackupController plus the
// `backup:database` artisan command it called.
//
// The PHP dumped with Spatie\DbDumper (a `mysqldump` wrapper) into
// `public/database-backup/{d-m-Y}/{d-m-Y}-dump.sql`. The same layout is kept so
// existing dumps stay listed and downloadable, and the download URL the Blade
// built - `public/database-backup/...` - still resolves under Next's `public/`.
// ---------------------------------------------------------------------------

import 'server-only';
import { spawn } from 'node:child_process';
import { readdir, mkdir, rm, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '@/lib/config';
import { pool, rawQuery } from '@/lib/db/client';
import { phpDate } from '@/lib/php-date';

const BACKUP_ROOT = path.join(process.cwd(), 'public', 'database-backup');
const TMP_ROOT = path.join(process.cwd(), 'public', 'tmpfile');

/** `checkValidDate($value, 'd-m-Y')` - only date-named folders are backups. */
export function isBackupFolder(name: string): boolean {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(name);
  if (!match) return false;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return (
    date.getFullYear() === Number(yyyy) &&
    date.getMonth() === Number(mm) - 1 &&
    date.getDate() === Number(dd)
  );
}

export type BackupEntry = {
  folder: string;
  fileName: string;
  downloadUrl: string;
};

/** `BackupController@index` */
export async function listBackups(): Promise<BackupEntry[]> {
  if (!existsSync(BACKUP_ROOT)) return [];

  const entries = await readdir(BACKUP_ROOT);
  return entries
    .filter(isBackupFolder)
    .sort()
    .reverse()
    .map((folder) => ({
      folder,
      fileName: `infix_trading_db_${folder}.sql`,
      downloadUrl: `/database-backup/${folder}/${folder}-dump.sql`,
    }));
}

/**
 * `Artisan::call('backup:database')` - shells out to `mysqldump` exactly as the
 * PHP dumper did, writing `{d-m-Y}/{d-m-Y}-dump.sql`.
 */
export async function createBackup(): Promise<{ ok: boolean; message: string }> {
  const today = phpDate('d-m-Y', new Date());
  const folder = path.join(BACKUP_ROOT, today);
  await mkdir(folder, { recursive: true });

  const target = path.join(folder, `${today}-dump.sql`);

  const args = [
    `--host=${config.db.host}`,
    `--port=${config.db.port}`,
    `--user=${config.db.user}`,
    '--skip-comments',
    '--extended-insert',
    '--single-transaction',
    config.db.database,
  ];

  return new Promise((resolve) => {
    const child = spawn(process.env.MYSQLDUMP_PATH || 'mysqldump', args, {
      windowsHide: true,
      env: { ...process.env, MYSQL_PWD: config.db.password },
    });

    const chunks: Buffer[] = [];
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        message: `mysqldump could not be started (${error.message}).`,
      });
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        resolve({ ok: false, message: stderr.trim() || `mysqldump exited with ${code}.` });
        return;
      }
      try {
        await writeFile(target, Buffer.concat(chunks));
        resolve({ ok: true, message: 'New database backup has been created' });
      } catch (error) {
        resolve({ ok: false, message: `Could not save backup: ${String(error)}` });
      }
    });
  });
}

/** `BackupController@delete` */
export async function deleteBackup(folder: string): Promise<boolean> {
  if (!isBackupFolder(folder)) return false;
  const dir = path.join(BACKUP_ROOT, folder);
  if (!existsSync(dir)) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}

/**
 * `BackupController@import` - truncates every table but `migrations`, then runs
 * the uploaded dump.
 */
export async function importDump(file: File): Promise<{ ok: boolean; message: string }> {
  if (!file.name.toLowerCase().endsWith('.sql')) {
    return { ok: false, message: 'Invalid File, file should be sql' };
  }

  await mkdir(TMP_ROOT, { recursive: true });
  const target = path.join(TMP_ROOT, path.basename(file.name));
  await writeFile(target, Buffer.from(await file.arrayBuffer()));

  const connection = await pool.getConnection();
  try {
    await connection.query('SET foreign_key_checks=0');

    const tables = await rawQuery<Record<string, string>>('SHOW TABLES');
    for (const row of tables) {
      const name = Object.values(row)[0];
      if (!name || name === 'migrations') continue;
      await connection.query(`TRUNCATE TABLE \`${name}\``);
    }

    await connection.query('SET foreign_key_checks=1');

    // mysql2 needs `multipleStatements` for a dump; use a dedicated connection.
    const sql = (await import('node:fs/promises')).readFile;
    const contents = await sql(target, 'utf8');
    const mysql = (await import('mysql2/promise')).default;
    const runner = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      multipleStatements: true,
    });
    await runner.query(contents);
    await runner.end();

    return { ok: true, message: 'Database import sunccessfullu' };
  } catch (error) {
    return { ok: false, message: String(error) };
  } finally {
    connection.release();
    if (existsSync(target)) await unlink(target);
  }
}
