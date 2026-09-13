// ---------------------------------------------------------------------------
// Asset path helpers.
//
// The database stores upload paths exactly as Laravel wrote them, e.g.
// `public/uploads/settings/logo.png`, because the PHP app served the project
// root. Next serves the `public/` directory at `/`, so the prefix is stripped.
// ---------------------------------------------------------------------------

import { existsSync } from 'node:fs';
import nodePath from 'node:path';

/** Laravel's `asset($path)` for a stored upload path. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('data:')) return path;
  return `/${path.replace(/^public\//, '').replace(/^\/+/, '')}`;
}

/** Avatar with the same `ui-avatars.com` fallback `User::defaultProfilePhotoUrl()` used. */
export function avatarUrl(
  avatar: string | null | undefined,
  name: string,
): string {
  return (
    assetUrl(avatar) ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&color=7F9CF5&background=EBF4FF`
  );
}

/** `get_file_type($file_name)` from Helper.php. */
export function getFileType(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/**
 * `assetUrl()`, but null when the file is not actually on disk.
 *
 * `general_settings.logo` points at whatever the PHP installation uploaded, and
 * a database restored without its `public/uploads` tree names files that are no
 * longer there. A client-side `onError` fallback still paints the broken-image
 * glyph for a frame before React can react to it, which is what the sidebar and
 * the login screen were showing. Checking on the server means the markup never
 * carries the dead `<img>` at all.
 *
 * Server-only by construction - it touches the filesystem - so callers are the
 * layouts and pages that resolve the logo, not client components.
 */
export function uploadedAssetUrl(storedPath: string | null | undefined): string | null {
  const url = assetUrl(storedPath);
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  // `url` is root-relative, and `public/` is what Next serves at the root.
  const onDisk = nodePath.join(process.cwd(), 'public', url.replace(/^\/+/, ''));
  return existsSync(onDisk) ? url : null;
}
