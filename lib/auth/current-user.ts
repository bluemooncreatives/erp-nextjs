// ---------------------------------------------------------------------------
// The authenticated user, plus everything the Blade layer used to reach for via
// `auth()->user()`, `auth()->user()->staff`, `auth()->user()->role` and
// `app('permission_list')`.
//
// Loaded once per request and memoised with React's `cache()` so a page, its
// layout and any nested server components share a single set of queries -
// the equivalent of Laravel resolving a singleton from the container.
// ---------------------------------------------------------------------------

import 'server-only';
import { cache } from 'react';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  permissions,
  rolePermission,
  roles,
  showRooms,
  staffs,
  users,
  wareHouses,
} from '@/lib/db/schema';
import { getSession } from './session';

export type AuthUser = {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  avatar: string | null;
  photo: string | null;
  signature: string | null;
  isActive: number;
  roleId: number;
  contactId: string | null;
  currentWorkspaceId: number | null;
  notificationPreference: string;

  role: { id: number; name: string; type: string };

  /** `auth()->user()->staff` - null for admins with no staff record. */
  staff: {
    id: number;
    employeeId: string | null;
    departmentId: number | null;
    showroomId: number | null;
    warehouseId: number | null;
    phone: string | null;
    basicSalary: string | null;
    dateOfJoining: string | null;
    openingBalance: number | null;
  } | null;

  /** Branch/warehouse the user operates in, resolved like `loginPermit()` did. */
  showroomId: number | null;
  showroomName: string | null;
  warehouseId: number | null;
  warehouseName: string | null;

  /** Route names this user may reach. Empty for system users - they bypass. */
  permissionRoutes: Set<string>;

  /** roles.type === 'system_user' - bypasses every permission check. */
  isSystemUser: boolean;
};

/**
 * Load every permission route granted to a role.
 * Equivalent of `app('permission_list')->where('id', $role_id)->first()->permissions`.
 */
export const loadRolePermissions = cache(async (roleId: number): Promise<Set<string>> => {
  const rows = await db
    .select({ route: permissions.route })
    .from(rolePermission)
    .innerJoin(permissions, eq(permissions.id, rolePermission.permissionId))
    .where(and(eq(rolePermission.roleId, roleId), eq(rolePermission.status, 1)));

  const set = new Set<string>();
  for (const r of rows) if (r.route) set.add(r.route);
  return set;
});

/**
 * The current user, or null when unauthenticated.
 * Mirrors `auth()->user()` with the `staff`, `role` and branch context eager-loaded.
 */
export const currentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select({
      u: users,
      r: roles,
      s: staffs,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(staffs, eq(staffs.userId, users.id))
    .where(eq(users.id, session.uid))
    .limit(1);

  if (!row) return null;

  // Laravel's `loginPermit()` refuses deactivated accounts on every request.
  if (!row.u.isActive) return null;

  const isSystemUser = row.r.type === 'system_user';

  // A system user has no staff row, so the PHP helper fell back to the first
  // branch. Reproduce that so branch-scoped queries behave identically.
  let showroomId = row.s?.showroomId ?? null;
  if (isSystemUser && !showroomId) {
    const [first] = await db
      .select({ id: showRooms.id })
      .from(showRooms)
      .orderBy(showRooms.id)
      .limit(1);
    showroomId = first?.id ?? null;
  }
  const warehouseId = row.s?.warehouseId ?? null;

  const [showroom] = showroomId
    ? await db
        .select({ name: showRooms.name })
        .from(showRooms)
        .where(eq(showRooms.id, showroomId))
        .limit(1)
    : [];

  const [warehouse] = warehouseId
    ? await db
        .select({ name: wareHouses.name })
        .from(wareHouses)
        .where(eq(wareHouses.id, warehouseId))
        .limit(1)
    : [];

  const permissionRoutes = isSystemUser
    ? new Set<string>()
    : await loadRolePermissions(row.u.roleId);

  return {
    id: row.u.id,
    name: row.u.name,
    username: row.u.username,
    email: row.u.email,
    avatar: row.u.avatar,
    photo: row.u.photo,
    signature: row.u.signature,
    isActive: row.u.isActive,
    roleId: row.u.roleId,
    contactId: row.u.contactId,
    currentWorkspaceId: row.u.currentWorkspaceId,
    notificationPreference: row.u.notificationPreference,

    role: { id: row.r.id, name: row.r.name, type: row.r.type },

    staff: row.s
      ? {
          id: row.s.id,
          employeeId: row.s.employeeId,
          departmentId: row.s.departmentId,
          showroomId: row.s.showroomId,
          warehouseId: row.s.warehouseId,
          phone: row.s.phone,
          basicSalary: row.s.basicSalary,
          dateOfJoining: row.s.dateOfJoining,
          openingBalance: row.s.openingBalance,
        }
      : null,

    showroomId,
    showroomName: showroom?.name ?? null,
    warehouseId,
    warehouseName: warehouse?.name ?? null,

    permissionRoutes,
    isSystemUser,
  };
});

/** Ids of every role that holds a given permission route - used by approval flows. */
export async function rolesWithPermission(route: string): Promise<number[]> {
  const rows = await db
    .select({ roleId: rolePermission.roleId })
    .from(rolePermission)
    .innerJoin(permissions, eq(permissions.id, rolePermission.permissionId))
    .where(and(eq(permissions.route, route), eq(rolePermission.status, 1)));
  return rows.map((r) => r.roleId).filter((v): v is number => v != null);
}

/** Users belonging to any of the given roles - used for notification fan-out. */
export async function usersInRoles(roleIds: number[]) {
  if (roleIds.length === 0) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(inArray(users.roleId, roleIds), eq(users.isActive, 1)));
}
