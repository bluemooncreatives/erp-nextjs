// Attendance - port of AttendanceController@index.
//
// Marks one day at a time for every active user in a role, which is how the
// Blade sheet worked.

import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles, users } from '@/lib/db/schema';
import { attendanceForDate } from '@/lib/hr/leave';
import { today } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { AttendanceSheet } from './attendance-sheet';

export const metadata: Metadata = { title: 'Attendance' };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; role_id?: string }>;
}) {
  await authorize('attendances.index');
  const sp = await searchParams;

  const date = sp.date ?? today();
  const roleId = sp.role_id ? Number(sp.role_id) : null;

  const roleRows = await db.select().from(roles).orderBy(roles.id);

  const staffRows = roleId
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.roleId, roleId), eq(users.isActive, 1)))
        .orderBy(users.name)
    : [];

  const existing = roleId ? await attendanceForDate(date, roleId) : [];
  const marks = new Map(
    existing.map((e) => [e.attendance.userId, e.attendance.attendance]),
  );
  const notes = new Map(existing.map((e) => [e.attendance.userId, e.attendance.note]));

  return (
    <>
      <PageHeader
        title="Attendance"
        breadcrumb={[{ label: 'Human Resource'}, { label:'Attendance' }]}
        actions={
          <form
            action={ROUTES['attendances.index']}
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <select
              name="role_id"
              defaultValue={roleId ?? ''}
              className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
            >
              <option value="">Select role</option>
              {roleRows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary"
            >
              Load
            </button>
          </form>
        }
      />

      <AttendanceSheet
        date={date}
        roleId={roleId}
        staff={staffRows.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          mark: marks.get(s.id) ?? 'P',
          note: notes.get(s.id) ?? '',
        }))}
      />
    </>
  );
}
