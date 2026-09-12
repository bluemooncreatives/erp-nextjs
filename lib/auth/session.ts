// ---------------------------------------------------------------------------
// Session management.
//
// Laravel used a server-side file session driver plus a `laravel_session`
// cookie. This replaces it with a signed, stateless JWT cookie (jose), keeping
// the same payload the PHP app kept in the session:
//
//   user id, role_id, showroom_id   (set by the `loginPermit()` helper)
//
// SESSION_LIFETIME from .env still controls expiry, in minutes.
// ---------------------------------------------------------------------------

import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { config } from '@/lib/config';

export type SessionPayload = {
  /** users.id */
  uid: number;
  /** users.role_id - mirrors Laravel's `session('role_id')` */
  roleId: number;
  /** roles.type: system_user | regular_user | normal_user */
  roleType: string;
  /** Mirrors Laravel's `session('showroom_id')` set in `loginPermit()`. */
  showroomId: number | null;
  /** staffs.id for the logged-in user, when they are a staff member. */
  staffId: number | null;
  /** Locale code - replaces the `Localization` middleware's session value. */
  locale: string;
};

const encoder = new TextEncoder();
const key = encoder.encode(config.session.secret);
const ALG = 'HS256';

export async function encodeSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${config.session.lifetimeMinutes}m`)
    .sign(key);
}

export async function decodeSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    if (typeof payload.uid !== 'number') return null;
    return {
      uid: payload.uid as number,
      roleId: (payload.roleId as number) ?? 0,
      roleType: (payload.roleType as string) ?? 'normal_user',
      showroomId: (payload.showroomId as number | null) ?? null,
      staffId: (payload.staffId as number | null) ?? null,
      locale: (payload.locale as string) ?? 'en',
    };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encodeSession(payload);
  const jar = await cookies();
  jar.set(config.session.cookie, token, {
    httpOnly: true,
    secure: config.app.env === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: config.session.lifetimeMinutes * 60,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return decodeSession(jar.get(config.session.cookie)?.value);
}

/** Mirrors Laravel's `Session::flush()` + `Auth::logout()`. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(config.session.cookie);
}

/** Re-issue the cookie with an updated payload (e.g. branch or locale switch). */
export async function patchSession(patch: Partial<SessionPayload>): Promise<void> {
  const current = await getSession();
  if (!current) return;
  await createSession({ ...current, ...patch });
}
