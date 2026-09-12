// ---------------------------------------------------------------------------
// Signed links - the equivalent of `URL::temporarySignedRoute()`, used by the
// email-verification notification.
//
// Laravel appended `expires` and `signature` query parameters and checked them
// with the application key; the same shape is kept here so the link looks and
// behaves the same, signed with an HMAC over the path and the other query
// parameters.
// ---------------------------------------------------------------------------

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '@/lib/config';

function secret(): string {
  return config.app.key || 'infix-biz-fallback-key';
}

function signaturePayload(path: string, params: URLSearchParams): string {
  const copy = new URLSearchParams(params);
  copy.delete('signature');
  copy.sort();
  const query = copy.toString();
  return query ? `${path}?${query}` : path;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** `URL::temporarySignedRoute($route, now()->addMinutes($minutes), $params)` */
export function temporarySignedUrl(
  baseUrl: string,
  path: string,
  minutes = 60,
  params: Record<string, string | number> = {},
): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set(
    'expires',
    String(Math.floor(Date.now() / 1000) + minutes * 60),
  );
  url.searchParams.set('signature', sign(signaturePayload(url.pathname, url.searchParams)));
  return url.toString();
}

/** `$request->hasValidSignature()` - signature intact and not past `expires`. */
export function hasValidSignature(pathname: string, params: URLSearchParams): boolean {
  const provided = params.get('signature') ?? '';
  const expires = Number(params.get('expires') ?? 0);
  if (!provided || !Number.isFinite(expires)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;

  const expected = sign(signaturePayload(pathname, params));
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
