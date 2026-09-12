// ---------------------------------------------------------------------------
// MySQL connection pool + Drizzle client.
//
// Replaces Laravel's `DB` facade / Eloquent connection. Uses a module-level
// singleton so Next.js hot-reload in dev does not leak pools.
// ---------------------------------------------------------------------------

import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { config } from '@/lib/config';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __erpPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: config.db.charset,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Laravel returns DATE columns as plain 'Y-m-d' strings; match that so
    // date maths in ported repositories behaves identically.
    dateStrings: ['DATE'],
    // The PHP schema uses DOUBLE(16,2) heavily; mysql2 hands those back as
    // numbers already, but DECIMAL would come back as a string - normalise.
    decimalNumbers: true,
    timezone: 'Z',
  });
}

export const pool: mysql.Pool = global.__erpPool ?? createPool();
if (config.app.env !== 'production') global.__erpPool = pool;

export const db: MySql2Database<typeof schema> = drizzle(pool, {
  schema,
  mode: 'default',
});

export { schema };

/**
 * Run a set of statements inside a single transaction.
 * Mirrors Laravel's `DB::transaction(fn () => ...)`.
 */
export async function transaction<T>(
  fn: (tx: MySql2Database<typeof schema>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => fn(tx as MySql2Database<typeof schema>));
}

/** Escape hatch for the handful of reports that were raw SQL in the PHP app. */
export async function rawQuery<T = Record<string, unknown>>(
  sqlText: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await pool.query(sqlText, params);
  return rows as T[];
}
