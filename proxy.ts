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

  // `verification.verify` sat behind `auth` in Laravel: a signed-in user must
  // be able to open the link they were mailed.
  const isVerificationLink = /^\/email\/verify\/\d+\/[0-9a-f]+$/.test(pathname);

  // `RedirectIfAuthenticated` - signed-in users never see the login screen.
  if (session && isGuestPath(pathname) && !isVerificationLink) {
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
    // Everything except Next's own routes, static assets and uploaded files.
    //
    // `_next` must be excluded whole, not just `_next/static` and
    // `_next/image`: development serves hot reloading over a WebSocket at
    // `/_next/hmr`, and running this middleware on the upgrade request answers
    // it with an ordinary HTTP response. The handshake then fails, the dev
    // client never finishes booting, and the page renders but never hydrates -
    // every button and dropdown in `next dev` is inert.
    //
    // The file-extension branch keeps the public folders (images, fonts, the
    // TailAdmin assets) reachable while signed out, instead of redirecting
    // them to the login page.
    '/((?!_next|uploads|backEnd|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|map|txt|xml|json|woff2?|ttf|eot)$).*)',
  ],
};
