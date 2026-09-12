// ---------------------------------------------------------------------------
// File and image storage - port of app/Traits/ImageStore.php.
//
// The PHP wrote into the project's `public/` directory and stored that relative
// path (e.g. `public/uploads/images/12-05-2021/60a1f.jpg`) in the database.
// Next serves `public/` at the web root, so files are written to the same
// folder structure and the same string is stored - existing rows keep resolving
// through `assetUrl()`.
//
// Intervention Image's resize is reproduced with sharp.
// ---------------------------------------------------------------------------

import 'server-only';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/** Project-relative `public/` directory - where Laravel wrote these files. */
const PUBLIC_DIR = path.join(process.cwd(), 'public');

/** `Carbon::now()->format('d-m-Y')` - the per-day folder the PHP used. */
function dateFolder(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

function uniqid(): string {
  // PHP's uniqid() is a 13-character hex timestamp.
  return Date.now().toString(16) + Math.floor(Math.random() * 0xfffff).toString(16);
}

/** Turn `public/uploads/...` into an absolute path under this project. */
function absolutePath(storedPath: string): string {
  return path.join(PUBLIC_DIR, storedPath.replace(/^public\//, ''));
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function fileBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

function extensionFor(file: File): string {
  const fromMime = file.type.replace('image/', '');
  if (fromMime && fromMime !== file.type) return fromMime;
  const fromName = file.name.split('.').pop();
  return fromName ?? 'bin';
}

/**
 * `saveImage($image, $height, $length)` - resizes when both dimensions are
 * given, and returns the stored path.
 */
export async function saveImage(
  file: File | null | undefined,
  width?: number,
  height?: number,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const folder = `public/uploads/images/${dateFolder()}`;
  await ensureDir(absolutePath(folder));

  const ext = extensionFor(file);
  const stored = `${folder}/${uniqid()}.${ext}`;

  let buffer = await fileBuffer(file);
  if (width != null && height != null) {
    buffer = await sharp(buffer).resize(width, height).toBuffer();
  }

  await writeFile(absolutePath(stored), buffer);
  return stored;
}

/** `saveSettingsImage()` - logos and favicons, no per-day folder. */
export async function saveSettingsImage(
  file: File | null | undefined,
  width?: number,
  height?: number,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const folder = 'public/uploads/settings';
  await ensureDir(absolutePath(folder));

  const ext = extensionFor(file);
  const stored = `${folder}/${uniqid()}.${ext}`;

  let buffer = await fileBuffer(file);
  if (width != null && height != null) {
    buffer = await sharp(buffer).resize(width, height).toBuffer();
  }

  await writeFile(absolutePath(stored), buffer);
  return stored;
}

/** `saveAvatar()` */
export async function saveAvatar(
  file: File | null | undefined,
  width?: number,
  height?: number,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const folder = `public/uploads/avatar/${dateFolder()}`;
  await ensureDir(absolutePath(folder));

  const ext = extensionFor(file);
  const stored = `${folder}/${uniqid()}.${ext}`;

  let buffer = await fileBuffer(file);
  if (width != null && height != null) {
    buffer = await sharp(buffer).resize(width, height).toBuffer();
  }

  await writeFile(absolutePath(stored), buffer);
  return stored;
}

/**
 * `saveFile($file)` - documents kept their original filename under
 * `public/uploads/document/`, and only the NAME was stored.
 */
export async function saveDocument(
  file: File | null | undefined,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const folder = 'public/uploads/document';
  await ensureDir(absolutePath(folder));

  const name = path.basename(file.name);
  await writeFile(absolutePath(`${folder}/${name}`), await fileBuffer(file));
  return name;
}

/**
 * Uploads attached to a document (sale, purchase, quotation). The PHP prefixed
 * the original name with `uniqid()` and stored the path.
 */
export async function saveUpload(
  file: File | null | undefined,
  subfolder: string,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const folder = `public/uploads/${subfolder.replace(/^\/+|\/+$/g, '')}`;
  await ensureDir(absolutePath(folder));

  const name = `${uniqid()}${path.basename(file.name)}`;
  const stored = `${folder}/${name}`;
  await writeFile(absolutePath(stored), await fileBuffer(file));
  // The PHP stored these with a leading slash and no `public/` prefix.
  return `/${stored.replace(/^public\//, '')}`;
}

/** `deleteImage($url)` */
export async function deleteStoredFile(
  storedPath: string | null | undefined,
): Promise<boolean> {
  if (!storedPath) return false;
  const target = absolutePath(storedPath);
  if (!existsSync(target)) return false;
  try {
    await unlink(target);
    return true;
  } catch {
    return false;
  }
}

/** Collect the files posted under one field name, dropping empty entries. */
export function filesFrom(formData: FormData, field: string): File[] {
  return formData
    .getAll(field)
    .filter((v): v is File => v instanceof File && v.size > 0);
}

export function fileFrom(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}
