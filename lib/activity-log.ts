// ---------------------------------------------------------------------------
// Activity log - port of Modules/UserActivityLog/Traits/LogActivity.php
//
// Writes to the same `log_activity` table. The PHP trait built the `agent`
// string from hisorange/browser-detect as
//   family-version-engine-platform-device
// which is reproduced here from the User-Agent header so the logout matcher
// (which compares ip + agent) still pairs a logout with its login row.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import { logActivity, users } from '@/lib/db/schema';

/** `log_activity.type` values used by the PHP trait. */
export const LogType = {
  Error: 0,
  Success: 1,
  Warning: 2,
  Info: 3,
} as const;

async function requestContext() {
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  return {
    url: buildFullUrl(h),
    method: 'GET',
    ip: clientIp(h),
    agent: describeBrowser(ua),
  };
}

function buildFullUrl(h: Headers): string {
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host') ?? '';
  // Next exposes the matched path on this header; fall back to the referer.
  const path = h.get('x-invoke-path') ?? h.get('referer') ?? '/';
  return path.startsWith('http') ? path : `${proto}://${host}${path}`;
}

function clientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip') ?? '127.0.0.1';
}

/**
 * Rebuild the `family-version-engine-platform-device` string the PHP stack
 * stored, so login and logout rows still match on the agent column.
 */
export function describeBrowser(ua: string): string {
  const family = matchFirst(ua, [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
    [/Firefox\//, 'Firefox'],
    [/MSIE|Trident/, 'InternetExplorer'],
  ]) ?? 'Unknown';

  const version =
    /(?:Edg|OPR|Chrome|Firefox|Version)\/(\d+(?:\.\d+)?)/.exec(ua)?.[1] ?? '0';

  const engine = matchFirst(ua, [
    [/Gecko\/|Firefox\//, 'Gecko'],
    [/AppleWebKit\//, 'WebKit'],
    [/Trident/, 'Trident'],
  ]) ?? 'Unknown';

  const platform = matchFirst(ua, [
    [/Windows/, 'Windows'],
    [/Android/, 'Android'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Mac OS X/, 'OS X'],
    [/Linux/, 'Linux'],
  ]) ?? 'Unknown';

  const device = matchFirst(ua, [
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
  ]) ?? '';

  return `${family}-${version}-${engine}-${platform}-${device}`;
}

function matchFirst(ua: string, pairs: Array<[RegExp, string]>): string | null {
  for (const [re, label] of pairs) if (re.test(ua)) return label;
  return null;
}

/** `LogActivity::addLog($type, $subject)` */
export async function addLog(type: number, subject: string, userId?: number | null) {
  const ctx = await requestContext();
  await db.insert(logActivity).values({
    type,
    subject: subject.slice(0, 191),
    url: ctx.url.slice(0, 191),
    method: ctx.method,
    ip: ctx.ip,
    agent: ctx.agent.slice(0, 191),
    login: 0,
    userId: userId ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export const errorLog = (m: string, u?: number | null) => addLog(LogType.Error, m, u);
export const successLog = (m: string, u?: number | null) => addLog(LogType.Success, m, u);
export const warningLog = (m: string, u?: number | null) => addLog(LogType.Warning, m, u);
export const infoLog = (m: string, u?: number | null) => addLog(LogType.Info, m, u);

/** `LogActivity::loginLog($message)` - writes the `login = 1` duty row. */
export async function loginLog(subject: string, userId: number) {
  const ctx = await requestContext();
  await db.insert(logActivity).values({
    type: LogType.Success,
    login: 1,
    loginTime: new Date(),
    logoutTime: null,
    subject: subject.slice(0, 191),
    url: ctx.url.slice(0, 191),
    method: ctx.method,
    ip: ctx.ip,
    agent: ctx.agent.slice(0, 191),
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/**
 * `LogActivity::logoutLog($user_id, $message)` - closes the open duty row that
 * matches this user + ip + agent.
 */
export async function logoutLog(userId: number, subject: string) {
  const ctx = await requestContext();
  const [open] = await db
    .select({ id: logActivity.id })
    .from(logActivity)
    .where(
      and(
        eq(logActivity.login, 1),
        isNull(logActivity.logoutTime),
        eq(logActivity.userId, userId),
        eq(logActivity.ip, ctx.ip),
        eq(logActivity.agent, ctx.agent.slice(0, 191)),
      ),
    )
    .limit(1);

  if (!open) return;

  await db
    .update(logActivity)
    .set({ logoutTime: new Date(), subject: subject.slice(0, 191), updatedAt: new Date() })
    .where(eq(logActivity.id, open.id));
}

/** `LogActivity::logActivityLists()` - the non-duty rows, newest first. */
export async function logActivityLists(limit = 200) {
  return db
    .select({
      id: logActivity.id,
      subject: logActivity.subject,
      type: logActivity.type,
      url: logActivity.url,
      method: logActivity.method,
      ip: logActivity.ip,
      agent: logActivity.agent,
      createdAt: logActivity.createdAt,
      updatedAt: logActivity.updatedAt,
      userName: users.name,
    })
    .from(logActivity)
    .leftJoin(users, eq(users.id, logActivity.userId))
    .where(eq(logActivity.login, 0))
    .orderBy(desc(logActivity.createdAt))
    .limit(limit);
}

/** `LogActivity::logActivityListsDuty()` - the login/logout rows. */
export async function logActivityListsDuty(limit = 200) {
  return db
    .select({
      id: logActivity.id,
      subject: logActivity.subject,
      type: logActivity.type,
      ip: logActivity.ip,
      agent: logActivity.agent,
      loginTime: logActivity.loginTime,
      logoutTime: logActivity.logoutTime,
      createdAt: logActivity.createdAt,
      userName: users.name,
    })
    .from(logActivity)
    .leftJoin(users, eq(users.id, logActivity.userId))
    .where(eq(logActivity.login, 1))
    .orderBy(desc(logActivity.createdAt))
    .limit(limit);
}
