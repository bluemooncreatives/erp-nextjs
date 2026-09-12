// ---------------------------------------------------------------------------
// Authorization - a direct port of the PHP stack's two checks:
//
//   * `permissionCheck($route_name)`  (app/Helpers/Helper.php) - used by Blade
//     to decide whether to render a menu entry or an action button.
//   * the `permission` middleware  (app/Http/Middleware/Permission.php) - used
//     to guard the route itself, with its two rewrite rules:
//         `foo.create` is authorised by the `foo.store` permission
//         `foo.update` is authorised by the `foo.edit`  permission
//
// System users (roles.type === 'system_user') bypass both, exactly as before.
// ---------------------------------------------------------------------------

import 'server-only';
import { forbidden, unauthorized } from 'next/navigation';
import { currentUser, type AuthUser } from './current-user';

/** Apply the middleware's `.create` -> `.store` / `.update` -> `.edit` rewrites. */
export function effectiveRoute(routeName: string): string {
  if (routeName.endsWith('.create')) return routeName.replace(/\.create$/, '.store');
  if (routeName.endsWith('.update')) return routeName.replace(/\.update$/, '.edit');
  return routeName;
}

/** `permissionCheck($route)` - safe to call anywhere, never throws. */
export async function can(routeName: string): Promise<boolean> {
  const user = await currentUser();
  return userCan(user, routeName);
}

/** Synchronous form for when the user is already loaded (menus, tables). */
export function userCan(user: AuthUser | null, routeName: string): boolean {
  if (!user) return false;
  if (user.isSystemUser) return true;
  return user.permissionRoutes.has(effectiveRoute(routeName));
}

/** True when the user holds at least one of the routes - for parent menu items. */
export function userCanAny(user: AuthUser | null, routeNames: string[]): boolean {
  if (!user) return false;
  if (user.isSystemUser) return true;
  return routeNames.some((r) => user.permissionRoutes.has(effectiveRoute(r)));
}

export async function canAny(routeNames: string[]): Promise<boolean> {
  const user = await currentUser();
  return userCanAny(user, routeNames);
}

/**
 * Guard a page or route handler. Returns the user so callers can use it
 * directly, the way a Laravel controller reached for `auth()->user()`.
 *
 * Throws Next's `unauthorized()` (401) when signed out and `forbidden()` (403)
 * when signed in without the permission - matching the middleware's `abort(401)`
 * for the unauthorised case.
 */
export async function authorize(routeName?: string): Promise<AuthUser> {
  const user = await currentUser();
  if (!user) unauthorized();
  if (routeName && !userCan(user, routeName)) forbidden();
  return user;
}

/** Guard that only requires a signed-in user, with no permission attached. */
export async function requireUser(): Promise<AuthUser> {
  const user = await currentUser();
  if (!user) unauthorized();
  return user;
}

/**
 * `canApprove()` from Helper.php - role 1 (Super admin) and 2 (Admin) may
 * approve anything.
 *
 * The PHP helper had a second branch that looked up a department head via
 * `Modules\HR\Entities\Staff` and `Modules\organization\Entities\Department`.
 * Neither module ships in this codebase and `departments` has no `user_id`
 * column, so that branch could only ever fatal. Only the reachable behaviour
 * is ported: admins approve, everyone else does not.
 */
export async function canApprove(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  return user.roleId === 1 || user.roleId === 2;
}
