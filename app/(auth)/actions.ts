'use server';

// ---------------------------------------------------------------------------
// Authentication server actions.
//
// Ports app/Http/Controllers/Auth/LoginController.php, RegisterController.php,
// ForgotPasswordController.php and ResetPasswordController.php, including:
//
//   * login by EMAIL OR USERNAME (`LoginController::credentials()`)
//   * the deactivated-account and contact-login rules
//   * throttling (5 attempts, 1 minute decay) from the ThrottlesLogins trait
//   * `loginPermit()` - resolves the branch and refuses inactive users
//   * the login / logout rows in `log_activity`
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { and, eq, or } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import { passwordResets, roles, showRooms, staffs, users } from '@/lib/db/schema';
import { hashPassword, randomString, verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession, getSession } from '@/lib/auth/session';
import { generalSetting } from '@/lib/settings';
import { loginLog, logoutLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// --- Throttling ------------------------------------------------------------
// Laravel used the cache-backed RateLimiter. An in-process map is the direct
// equivalent for a single node; swap for Redis when running more than one.
const MAX_ATTEMPTS = 5;
const DECAY_MS = 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function throttleKey(login: string, ip: string) {
  return `${login.toLowerCase()}|${ip}`;
}

function tooManyAttempts(key: string): number | null {
  const entry = attempts.get(key);
  if (!entry) return null;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return null;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return Math.ceil((entry.resetAt - Date.now()) / 1000);
  }
  return null;
}

function hitAttempt(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: Date.now() + DECAY_MS });
    return;
  }
  entry.count += 1;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || '127.0.0.1';
}

// --- Login -----------------------------------------------------------------

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const login = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  // `validateLogin()` - both fields required.
  const fieldErrors: Record<string, string> = {};
  if (!login) fieldErrors.email = 'The email field is required.';
  if (!password) fieldErrors.password = 'The password field is required.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const key = throttleKey(login, await clientIp());
  const retryAfter = tooManyAttempts(key);
  if (retryAfter !== null) {
    return {
      error: `Too many login attempts. Please try again in ${retryAfter} seconds.`,
    };
  }

  // `credentials()` - resolve by username first, then by email.
  const [row] = await db
    .select({ u: users, r: roles, s: staffs })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(staffs, eq(staffs.userId, users.id))
    .where(or(eq(users.username, login), eq(users.email, login)))
    .limit(1);

  if (!row) {
    hitAttempt(key);
    return { error: 'These credentials do not match our records.' };
  }

  if (!row.u.isActive) {
    hitAttempt(key);
    return { error: 'Your account has been suspended. Please contact the administrator.' };
  }

  // Supplier (4) and Customer (5) may only sign in when `contact_login` is on.
  const setting = await generalSetting();
  if ((row.u.roleId === 4 || row.u.roleId === 5) && !setting.contactLogin) {
    hitAttempt(key);
    return { error: 'You do not have permission to log in.' };
  }

  if (!(await verifyPassword(password, row.u.password))) {
    hitAttempt(key);
    return { error: 'These credentials do not match our records.' };
  }

  // `loginPermit()` - system users fall back to the first branch, regular users
  // take their staff record's branch, normal users have none.
  let showroomId: number | null = null;
  if (row.r.type === 'system_user') {
    const [first] = await db
      .select({ id: showRooms.id })
      .from(showRooms)
      .orderBy(showRooms.id)
      .limit(1);
    showroomId = first?.id ?? null;
  } else if (row.r.type === 'regular_user') {
    showroomId = row.s?.showroomId ?? null;
  }

  attempts.delete(key);

  await createSession({
    uid: row.u.id,
    roleId: row.u.roleId,
    roleType: row.r.type,
    showroomId,
    staffId: row.s?.id ?? null,
    locale: setting.languageName ?? 'en',
  });

  await loginLog(`${row.u.name} - logged in at : ${new Date().toISOString()}`, row.u.id);

  redirect(ROUTES['home']);
}

// --- Logout ----------------------------------------------------------------

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    const [row] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.uid))
      .limit(1);
    await logoutLog(
      session.uid,
      `${row?.name ?? 'User'} - logged out at : ${new Date().toISOString()}`,
    );
  }
  await destroySession();
  redirect('/login');
}

// --- Registration ----------------------------------------------------------

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password_confirmation') ?? '');

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'The name field is required.';
  if (!email) fieldErrors.email = 'The email field is required.';
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = 'The email must be a valid email address.';
  }
  if (password.length < 8) {
    fieldErrors.password = 'The password must be at least 8 characters.';
  }
  if (password !== confirm) {
    fieldErrors.password_confirmation = 'The password confirmation does not match.';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { fieldErrors: { email: 'The email has already been taken.' } };
  }

  // RegisterController created the account against the Staff role (3).
  await db.insert(users).values({
    name,
    email,
    password: await hashPassword(password),
    roleId: 3,
    isActive: 1,
    notificationPreference: 'mail',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  redirect('/login?registered=1');
}

// --- Password reset --------------------------------------------------------

export async function sendPasswordResetLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { fieldErrors: { email: 'The email field is required.' } };

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Laravel answers identically whether or not the address exists.
  if (user) {
    const token = randomString(64);
    await db.delete(passwordResets).where(eq(passwordResets.email, email));
    await db.insert(passwordResets).values({
      email,
      token: await hashPassword(token),
      createdAt: new Date(),
    });

    const { sendPasswordResetMail } = await import('@/lib/mail');
    await sendPasswordResetMail(email, token);
  }

  return { error: undefined, fieldErrors: { email: '' } };
}

export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password_confirmation') ?? '');

  if (password.length < 8) {
    return { fieldErrors: { password: 'The password must be at least 8 characters.' } };
  }
  if (password !== confirm) {
    return {
      fieldErrors: { password_confirmation: 'The password confirmation does not match.' },
    };
  }

  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.email, email))
    .limit(1);

  if (!reset || !(await verifyPassword(token, reset.token))) {
    return { error: 'This password reset token is invalid.' };
  }

  // Laravel expires reset tokens after 60 minutes (config/auth.php).
  const age = Date.now() - (reset.createdAt?.getTime() ?? 0);
  if (age > 60 * 60 * 1000) {
    return { error: 'This password reset token has expired.' };
  }

  await db
    .update(users)
    .set({ password: await hashPassword(password), updatedAt: new Date() })
    .where(eq(users.email, email));

  await db.delete(passwordResets).where(eq(passwordResets.email, email));

  redirect('/login?reset=1');
}

// --- Change password (authenticated) ---------------------------------------

export async function changePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await getSession();
  if (!session) redirect('/login');

  const current = String(formData.get('current_password') ?? '');
  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password_confirmation') ?? '');

  const [user] = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, session.uid))
    .limit(1);

  if (!user || !(await verifyPassword(current, user.password))) {
    return { fieldErrors: { current_password: 'The current password is incorrect.' } };
  }
  if (next.length < 8) {
    return { fieldErrors: { password: 'The password must be at least 8 characters.' } };
  }
  if (next !== confirm) {
    return {
      fieldErrors: { password_confirmation: 'The password confirmation does not match.' },
    };
  }

  await db
    .update(users)
    .set({ password: await hashPassword(next), updatedAt: new Date() })
    .where(eq(users.id, session.uid));

  return { error: undefined };
}

/** Used by the branch selector in the header - `session()->put('showroom_id', ..)`. */
export async function switchShowroom(showroomId: number): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (session.roleType !== 'system_user') return; // only admins may switch

  const [exists] = await db
    .select({ id: showRooms.id })
    .from(showRooms)
    .where(and(eq(showRooms.id, showroomId), eq(showRooms.status, 1)))
    .limit(1);
  if (!exists) return;

  await createSession({ ...session, showroomId });
}
