// ---------------------------------------------------------------------------
// Proxy (Next 16's renamed Middleware).
//
// Replaces Laravel's `auth` and `guest` route middleware with an optimistic
// cookie check. It deliberately does NOT hit the database - per-route
// authorization is enforced in the pages themselves via `authorize(route)`,
// the same way the `permission` middleware ran per request.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from 'next/server';
import { decodeSession } from '@/lib/auth/session';

const SESSION_COOKIE = process.env.SESSION_COOKIE ?? 'infix_biz_session';

/** Routes reachable while signed out - Laravel's `guest` middleware group. */
const GUEST_PATHS = [
  '/login',
  '/register',
  '/password/reset',
  '/password/email',
  '/password/confirm',
  '/email/verify',
];

function isGuestPath(pathname: string): boolean {
  return GUEST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decodeSession(token);

  // `RedirectIfAuthenticated` - signed-in users never see the login screen.
  if (session && isGuestPath(pathname)) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  if (!session && !isGuestPath(pathname)) {
    // Laravel's `Authenticate` middleware redirected to login and remembered
    // the intended URL; `redirect()->intended()` is reproduced with `?next=`.
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Expose the locale to server components, replacing the `Localization`
  // middleware's `App::setLocale(session('locale'))`.
  const response = NextResponse.next();
  if (session?.locale) response.headers.set('x-erp-locale', session.locale);
  response.headers.set('x-erp-path', pathname);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, static assets and uploaded files.
    '/((?!_next/static|_next/image|favicon.ico|uploads|backEnd|robots.txt|sitemap.xml).*)',
  ],
};
