// Attendance report - port of AttendanceController@report_index.
// One row per user, one column per day of the chosen month.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles } from '@/lib/db/schema';
import { attendanceReport } from '@/lib/hr/leave';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { Badge } from '@/components/erp/badge';
import { SelectControl } from '@/components/erp/select-control';

export const metadata: Metadata = { title: 'Attendance Report' };

const MARK_COLOUR: Record<string, 'success' | 'error' | 'warning'|'light'> = {
  P: 'success',
  A: 'error',
  L: 'warning',
  H: 'warning',
  F: 'light',
};

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; role_id?: string }>;
}) {
  await authorize('attendance_report.index');
  const sp = await searchParams;

  const now = new Date();
  const month = Number(sp.month ?? now.getUTCMonth() + 1);
  const year = Number(sp.year ?? now.getUTCFullYear());
  const roleId = sp.role_id ? Number(sp.role_id) : undefined;

  const roleRows = await db.select().from(roles).orderBy(roles.id);
  const report = await attendanceReport(month, year, roleId);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const pad = (n: number) => String(n).padStart(2, '0');

  const control =
    'h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground   ';

  return (
    <>
      <PageHeader
        title="Attendance Report"
        breadcrumb={[{ label: 'Human Resource'}, { label:'Attendance Report' }]}
        actions={
          <form
            action={ROUTES['attendance_report.index']}
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <SelectControl
              name="role_id"
              defaultValue={roleId ? String(roleId) : ''}
              placeholder="All roles"
              aria-label="Role"
              options={roleRows.map((r) => ({ value: String(r.id), label: r.name }))}
              className="sm:w-48"
            />
            <SelectControl
              name="month"
              defaultValue={String(month)}
              aria-label="Month"
              options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
                value: String(m),
                label: new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-US', {
                  month: 'long',
                  timeZone: 'UTC',
                }),
              }))}
              className="sm:w-40"
            />
            <input
              type="number"
              name="year"
              defaultValue={year}
              min="2000"
              max="2100"
              className={`${control} w-28`}
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary"
            >
              Show
            </button>
          </form>
        }
      />

      <Card
        title={`Report - ${month}/${year}`}
        bodyClassName=""
        actions={
          report.length > 0 ? (
            <Link
              href={route('attendance_report_print', {
                role_id: roleId ?? 0,
                month,
                year,
              })}
              target="_blank"
              className="text-xs font-medium text-primary hover:text-primary"
            >
              Print view
            </Link>
          ) : null
        }
      >
        {report.length === 0 ? (
          <EmptyState message="No attendance recorded for this period." />
        ) : (
          <div className="max-w-full overflow-x-auto custom-scrollbar">
            <table className="min-w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                    Staff
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className="px-1 py-3 text-center text-xs font-medium text-muted-foreground"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.map((row) => (
                  <tr key={row.userId}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground">
                      {row.userName}
                    </td>
                    {days.map((d) => {
                      const key = `${year}-${pad(month)}-${pad(d)}`;
                      const mark = row.marks[key];
                      return (
                        <td key={d} className="px-1 py-3 text-center">
                          {mark ? (
                            <Badge size="sm" color={MARK_COLOUR[mark] ?? 'light'}>
                              {mark}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground dark:text-foreground">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
