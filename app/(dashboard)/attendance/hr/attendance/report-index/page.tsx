// Attendance report - port of AttendanceController@report_index.
// One row per user, one column per day of the chosen month.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles } from '@/lib/db/schema';
import { attendanceReport } from '@/lib/hr/leave';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import Badge from '@/components/ui/badge/Badge';

export const metadata: Metadata = { title: 'Attendance Report' };

const MARK_COLOUR: Record<string, 'success' | 'error' | 'warning' | 'light'> = {
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
    'h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

  return (
    <>
      <PageHeader
        title="Attendance Report"
        breadcrumb={[{ label: 'Human Resource' }, { label: 'Attendance Report' }]}
        actions={
          <form
            action={ROUTES['attendance_report.index']}
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <select name="role_id" defaultValue={roleId ?? ''} className={control}>
              <option value="">All roles</option>
              {roleRows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select name="month" defaultValue={month} className={control}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-US', {
                    month: 'long',
                    timeZone: 'UTC',
                  })}
                </option>
              ))}
            </select>
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
              className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              Show
            </button>
          </form>
        }
      />

      <Card title={`Report - ${month}/${year}`} bodyClassName="">
        {report.length === 0 ? (
          <EmptyState message="No attendance recorded for this period." />
        ) : (
          <div className="max-w-full overflow-x-auto custom-scrollbar">
            <table className="min-w-full">
              <thead className="border-b border-gray-100 dark:border-white/[0.05]">
                <tr>
                  <th className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Staff
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className="px-1 py-3 text-center text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {report.map((row) => (
                  <tr key={row.userId}>
                    <td className="whitespace-nowrap px-4 py-3 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
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
                            <span className="text-gray-300 dark:text-gray-700">-</span>
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
