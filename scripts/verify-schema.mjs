// Compares lib/db/schema.ts against a live MySQL/MariaDB database.
//
//   node scripts/verify-schema.mjs "mysql://user:pass@host:port/db"
//
// Reports tables the schema declares that the database does not have, columns
// that do not exist, and columns whose SQL type does not match what Drizzle
// will send. Exits non-zero when anything mismatches, so it can gate a run.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const mysql = require('mysql2/promise');
const { getTableConfig } = require('drizzle-orm/mysql-core');

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Usage: node scripts/verify-schema.mjs <mysql-url>');
  process.exit(2);
}

function loadSchema() {
  const source = readFileSync('lib/db/schema.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const moduleObj = { exports: {} };
  vm.runInNewContext(code, { exports: moduleObj.exports, module: moduleObj, require, console });
  return moduleObj.exports;
}

/**
 * The base SQL type Drizzle will generate, without length or attributes.
 * `information_schema.columns.data_type` never carries "unsigned" (that lives
 * in `column_type`), so it is stripped here too.
 */
function baseType(column) {
  return String(column.getSQLType())
    .split('(')[0]
    .replace(/(^|\s)unsigned(\s|$)/g, '')
    .trim()
    .toLowerCase();
}

/** Types that are interchangeable for reading and writing through mysql2. */
const COMPATIBLE = new Map([
  ['datetime', new Set(['timestamp', 'datetime'])],
  ['timestamp', new Set(['timestamp', 'datetime'])],
  ['int', new Set(['int', 'integer', 'mediumint'])],
  ['bigint', new Set(['bigint'])],
  ['tinyint', new Set(['tinyint'])],
  ['double', new Set(['double', 'float', 'decimal'])],
  ['varchar', new Set(['varchar', 'char'])],
  ['text', new Set(['text', 'tinytext', 'mediumtext', 'longtext'])],
  ['longtext', new Set(['longtext', 'text', 'mediumtext'])],
  ['date', new Set(['date'])],
  ['time', new Set(['time'])],
  ['json', new Set(['json', 'longtext'])],
]);

function typesMatch(declared, actual) {
  if (declared === actual) return true;
  const allowed = COMPATIBLE.get(declared);
  return allowed ? allowed.has(actual) : false;
}

const schema = loadSchema();
const connection = await mysql.createConnection(url);
const [dbRow] = await connection.query('select database() as db');
const database = dbRow[0].db;

const [columnRows] = await connection.query(
  `select table_name as t, column_name as c, data_type as d
     from information_schema.columns where table_schema = ?`,
  [database],
);

const actual = new Map();
for (const row of columnRows) {
  const table = String(row.t);
  if (!actual.has(table)) actual.set(table, new Map());
  actual.get(table).set(String(row.c), String(row.d).toLowerCase());
}

const missingTables = [];
const missingColumns = [];
const typeMismatches = [];
let tableCount = 0;
let columnCount = 0;

for (const value of Object.values(schema)) {
  let config;
  try {
    config = getTableConfig(value);
  } catch {
    continue; // not a table export
  }

  tableCount++;
  const columns = actual.get(config.name);
  if (!columns) {
    missingTables.push(config.name);
    continue;
  }

  for (const column of config.columns) {
    columnCount++;
    const declared = baseType(column);
    const found = columns.get(column.name);
    if (!found) {
      missingColumns.push(`${config.name}.${column.name}`);
    } else if (!typesMatch(declared, found)) {
      typeMismatches.push(`${config.name}.${column.name}: schema ${declared}, database ${found}`);
    }
  }
}

const report = {
  database,
  tablesChecked: tableCount,
  columnsChecked: columnCount,
  tablesInDatabase: actual.size,
  missingTables,
  missingColumns,
  typeMismatches,
};

console.log(JSON.stringify(report, null, 2));
await connection.end();

const failed =
  missingTables.length || missingColumns.length || typeMismatches.length ? 1 : 0;
process.exit(failed);
