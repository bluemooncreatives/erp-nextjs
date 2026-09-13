// Asset helpers that touch the filesystem.
//
// These are separate from `lib/paths.ts` because that module is imported by
// client components, and anything reaching for `node:fs` there drags a Node
// built-in into the browser bundle - which Turbopack refuses outright.

import 'server-only';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import { assetUrl } from '@/lib/paths';

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
