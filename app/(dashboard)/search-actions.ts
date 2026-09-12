'use server';

// Port of HomeController@menuSearch - searches the `permissions` table for
// index/store/create routes whose name matches, and returns links the current
// user is actually allowed to open.

import { and, eq, like, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { permissions } from '@/lib/db/schema';
import { currentUser } from '@/lib/auth/current-user';
import { userCan } from '@/lib/auth/permissions';
import { ROUTES, type RouteName } from '@/lib/routes';

export type MenuSearchResult = { name: string; route: string; href: string };

export async function searchMenu(value: string): Promise<MenuSearchResult[]> {
  const user = await currentUser();
  if (!user) return [];

  const term = `%${value}%`;
  const rows = await db
    .select({ name: permissions.name, route: permissions.route })
    .from(permissions)
    .where(
      and(
        eq(permissions.status, 1),
        like(permissions.name, term),
        or(
          like(permissions.route, '%index%'),
          like(permissions.route, '%store%'),
          like(permissions.route, '%create%'),
        ),
      ),
    )
    .limit(15);

  const out: MenuSearchResult[] = [];
  for (const row of rows) {
    if (!row.route || !row.name) continue;
    // `route($permission->route)` would have thrown for a permission with no
    // matching route; skip those instead.
    const href = ROUTES[row.route as RouteName];
    if (!href) continue;
    if (!userCan(user, row.route)) continue;
    out.push({ name: row.name, route: row.route, href });
  }
  return out;
}
