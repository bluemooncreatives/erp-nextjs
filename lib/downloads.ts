// Serving a stored file back to the browser.
//
// Laravel's `HomeController@fileDownload` took the path as a comma-separated
// string, joined it with slashes and handed it straight to
// `response()->download(public_path($fileName))` - so `..,..,..,.env` walked
// out of `public/` and downloaded whatever it reached. That is not reproduced:
// the resolved path has to stay inside `public/`, and anything else is a 404.

import 'server-only';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.sql': 'application/sql',
};

/**
 * `explode(',', $document)` then `implode('/', ...)` - the Blade links encoded
 * a path's slashes as commas so it survived the route segment.
 */
export function decodeDocumentPath(document: string): string {
  return decodeURIComponent(document).split(',').join('/');
}

/** The file under `public/`, or null when the path escapes it or is missing. */
export function resolvePublicFile(relative: string): string | null {
  const cleaned = relative.replace(/^public\//, '').replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, cleaned);

  // `path.resolve` has already collapsed any `..`; if the result is not inside
  // `public/`, the request was trying to leave it.
  const inside =
    resolved === PUBLIC_DIR || resolved.startsWith(PUBLIC_DIR + path.sep);
  if (!inside) return null;

  if (!existsSync(resolved) || !statSync(resolved).isFile()) return null;
  return resolved;
}

/** A download response for a file under `public/`, or a 404. */
export function downloadPublicFile(relative: string): Response {
  const file = resolvePublicFile(relative);
  if (!file) return new Response("File Couldn't Find", { status: 404 });

  const name = path.basename(file);
  const type = CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(statSync(file).size),
      // `filename*` carries the non-ASCII form; `filename` is the fallback.
      'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
