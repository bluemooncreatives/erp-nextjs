import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import { db, transaction } from '@/lib/db/client';
import { roles, staffs, users } from '@/lib/db/schema';

/** User::CarryForward: all role entitlements minus leaves touching last year.
 * The PHP scope does not filter approval status or entitlement year. */
export async function carryForwardRows() {
  const previousYear = new Date().getFullYear() - 1;
  return db.select({ id: users.id, name: users.name, username: users.username, email: users.email, roleId: users.roleId,
    roleType: roles.type, staffId: staffs.id, carryForward: staffs.carryForward, active: staffs.isCarryActive,
    entitlement: sql<number>`coalesce((select sum(d.total_days) from leave_defines d where d.role_id = ${users.roleId}), 0) - coalesce((select sum(l.total_days) from apply_leaves l where l.user_id = ${users.id} and (year(l.start_date) = ${previousYear} or year(l.end_date) = ${previousYear})), 0)`,
  }).from(users).leftJoin(roles, eq(roles.id, users.roleId)).leftJoin(staffs, eq(staffs.userId, users.id)).orderBy(desc(users.id));
}

export async function generateCarryForward() {
  const rows = await carryForwardRows();
  await transaction(async (tx) => {
    for (const row of rows) {
      if (row.id === 1 || row.id === 2 || !row.staffId) continue;
      await tx.update(staffs).set({ carryForward: Number(row.entitlement), updatedAt: new Date() }).where(eq(staffs.id, row.staffId));
    }
  });
}

export async function setCarryForward(staffId: number, active: boolean) {
  const row = (await carryForwardRows()).find((item) => item.staffId === staffId);
  if (!row) throw new Error('Staff not found');
  await db.update(staffs).set({ carryForward: active ? Number(row.entitlement) : 0, isCarryActive: active ? 1 : 0, updatedAt: new Date() }).where(eq(staffs.id, staffId));
}
