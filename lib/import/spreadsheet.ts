// ---------------------------------------------------------------------------
// Spreadsheet reading for the "upload via CSV" screens.
//
// The PHP stack used `Importer::make('Excel')`, which accepted .csv, .xls and
// .xlsx and handed the controller a collection of rows: the first row holds the
// column names, every later row a record. This module produces the same shape
// from the uploaded file:
//
//   * .csv is parsed here (quoted fields, escaped quotes, CRLF)
//   * .xlsx is a zip of XML parts, unpacked with zlib and read directly
//   * .xls (binary BIFF) is read by the vendored SheetJS parser.
// ---------------------------------------------------------------------------

import 'server-only';
import { inflateRawSync } from 'node:zlib';
import { read, utils } from 'xlsx';

export type SheetRows = string[][];

export class UnsupportedSpreadsheetError extends Error {}

/** RFC 4180-style CSV, tolerant of CRLF and of a trailing newline. */
export function parseCsv(text: string): SheetRows {
  const rows: SheetRows = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // A UTF-8 BOM would otherwise become part of the first column name.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
      i++;
      continue;
    }
    if (char === ',') {
      pushField();
      i++;
      continue;
    }
    if (char === '\r') {
      i++;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field !== '' || row.length) pushRow();

  // Drop a trailing blank line.
  while (rows.length && rows[rows.length - 1].every((cell) => cell === '')) rows.pop();
  return rows;
}

// --- xlsx ------------------------------------------------------------------

/** Reads the entries of a zip archive (stored or deflated members only). */
function readZip(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();

  // Locate the end-of-central-directory record, scanning back over the comment.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 22 - 0xffff; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new UnsupportedSpreadsheetError('The file is not a readable .xlsx archive.');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    // The local header repeats the name and may carry a different extra field.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);

    if (method === 0) entries.set(name, Buffer.from(raw));
    else if (method === 8) entries.set(name, inflateRawSync(raw));

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return XML_ENTITIES[entity] ?? match;
  });
}

/** The text of every `<si>` in sharedStrings.xml, in index order. */
function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const item of xml.match(/<si\b[\s\S]*?<\/si>|<si\b[^>]*\/>/g) ?? []) {
    let text = '';
    for (const t of item.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? []) {
      text += decodeXml(t.replace(/^<t\b[^>]*>/, '').replace(/<\/t>$/, ''));
    }
    out.push(text);
  }
  return out;
}

/** "BC12" -> 54 (zero-based column index). */
function columnIndex(reference: string): number {
  const letters = reference.replace(/\d+$/, '');
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function parseSheet(xml: string, strings: string[]): SheetRows {
  const rows: SheetRows = [];

  for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g) ?? []) {
    const row: string[] = [];

    for (const cellXml of rowXml.match(/<c\b[\s\S]*?<\/c>|<c\b[^>]*\/>/g) ?? []) {
      const reference = /\br="([A-Z]+\d+)"/.exec(cellXml)?.[1];
      const type = /\bt="([^"]+)"/.exec(cellXml)?.[1] ?? 'n';

      let value = '';
      if (type === 'inlineStr') {
        value = (cellXml.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) ?? [])
          .map((t) => decodeXml(t.replace(/^<t\b[^>]*>/, '').replace(/<\/t>$/, '')))
          .join('');
      } else {
        const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];
        if (raw != null) {
          value = type === 's' ? (strings[Number(decodeXml(raw))] ?? '') : decodeXml(raw);
        }
      }

      const index = reference ? columnIndex(reference) : row.length;
      while (row.length < index) row.push('');
      row[index] = value;
    }

    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].every((cell) => cell === '')) rows.pop();
  return rows;
}

export function parseXlsx(buffer: Buffer): SheetRows {
  const files = readZip(buffer);

  // The workbook's first sheet, however the part happens to be named.
  const sheetName =
    [...files.keys()]
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort()[0] ?? null;
  if (!sheetName) throw new UnsupportedSpreadsheetError('The workbook has no worksheet.');

  const strings = files.has('xl/sharedStrings.xml')
    ? sharedStrings(files.get('xl/sharedStrings.xml')!.toString('utf8'))
    : [];

  return parseSheet(files.get(sheetName)!.toString('utf8'), strings);
}

/** Binary Excel support, including BIFF8 compound documents and older BIFF streams. */
export function parseXls(buffer: Buffer): SheetRows {
  const compound = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  const biff = buffer.length >= 4 && [0x0009, 0x0209, 0x0409, 0x0809].includes(buffer.readUInt16LE(0));
  if (!compound && !biff) throw new UnsupportedSpreadsheetError('The file is not a readable binary Excel workbook.');
  try {
    const workbook = read(buffer, { type: 'buffer', cellDates: false, cellFormula: false });
    const first = workbook.SheetNames[0];
    if (!first) throw new Error('No worksheet');
    return utils.sheet_to_json<string[]>(workbook.Sheets[first], { header: 1, defval: '', raw: false, blankrows: false });
  } catch {
    throw new UnsupportedSpreadsheetError('The Excel workbook is damaged, encrypted, or has no readable worksheet.');
  }
}

/**
 * Reads an uploaded file into rows. Returns an empty array when no file was
 * chosen, matching `if (!empty($data['file']))` in the repositories.
 */
export async function readSpreadsheet(file: File | null): Promise<SheetRows> {
  if (!file || file.size === 0) return [];

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith('.xlsx')) return parseXlsx(buffer);
  if (name.endsWith('.xls')) return parseXls(buffer);
  return parseCsv(buffer.toString('utf8'));
}

/**
 * The import loop shared by every `csv_upload_*` repository method: the first
 * row names the columns, and each later row becomes one record keyed by those
 * names. Blank trailing rows are skipped.
 */
export function rowsToRecords(rows: SheetRows): Array<Record<string, string>> {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = String(row[index] ?? '').trim();
      });
      return record;
    });
}

/** `fputcsv()` - the format the `csv_download` endpoints returned. */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell == null ? '' : String(cell);
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\n');
}
