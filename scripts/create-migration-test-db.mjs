import { loadEnv } from './lib/env.mjs';
import mysql from 'mysql2/promise';
import { writeFileSync } from 'node:fs';
loadEnv();
const source = process.env.DB_DATABASE;
const target = `erp_migration_${Date.now()}`;
const connection = await mysql.createConnection({host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD});
const quote = value => '`' + value.replaceAll('`', '``') + '`';
await connection.query(`CREATE DATABASE ${quote(target)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
const [tables] = await connection.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?', [source, 'BASE TABLE']);
for (const row of tables) {
 const name = quote(row.TABLE_NAME);
 await connection.query(`CREATE TABLE ${quote(target)}.${name} LIKE ${quote(source)}.${name}`);
 await connection.query(`INSERT INTO ${quote(target)}.${name} SELECT * FROM ${quote(source)}.${name}`);
}
// Keep write verification local, including any notification side effects.
await connection.query(`UPDATE ${quote(target)}.business_settings SET status = 0 WHERE type IN ('mail_notification','sms_verification','email_verification')`);
writeFileSync('artifacts/migration-test-db.json', JSON.stringify({database: target, source, tables: tables.length}, null, 2));
console.log(`Created isolated database ${target}: ${tables.length} tables`);
await connection.end();
