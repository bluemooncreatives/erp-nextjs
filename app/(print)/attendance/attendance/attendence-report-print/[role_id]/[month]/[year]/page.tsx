// `attendance_report_print` - AttendanceReportController@attendance_report_print,
// `attendance::attendance_reports.staff_attendance_print`.
//
// The controller streamed the report as a landscape PDF. dompdf has no
// equivalent here, so this is the same grid on a print sheet; "Save as PDF"
// produces the document the PDF route did.

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { attendanceReport } from '@/lib/hr/leave';
import { generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';

export const metadata: Metadata = { title: 'Staff Attendance' };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default async function AttendanceReportPrintPage({
  params,
}: {
  params: Promise<{ role_id: string; month: string; year: string }>;
}) {
  await requireUser();
  const { role_id, month, year } = await params;

  const roleId = Number(role_id) || undefined;
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  const [role] = roleId
    ? await db.select().from(roles).where(eq(roles.id, roleId)).limit(1)
    : [];

  const report = await attendanceReport(monthNumber, yearNumber, roleId);
  const setting = await generalSetting();
  const logo = assetUrl(setting.logo);

  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    <>
      <div className="mb-6 flex items-start justify-between border-b pb-5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-14 w-auto" />
        ) : (
          <span className="text-lg font-semibold">{setting.companyName}</span>
        )}
        <PrintButton />
      </div>

      <h1 className="mb-1 text-lg font-semibold">Staff Attendance</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        {[role?.name, MONTHS[monthNumber - 1], yearNumber].filter(Boolean).join(' - ')}
      </p>

      {report.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No attendance recorded for this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b">
              <tr>
                <th className="px-2 py-2 text-start font-medium">Staff</th>
                {days.map((day) => (
                  <th key={day} className="px-1 py-2 text-center font-medium">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.map((row) => (
                <tr key={row.userId} className="border-b last:border-0">
                  <td className="px-2 py-2 whitespace-nowrap">{row.userName ?? '-'}</td>
                  {days.map((day) => (
                    <td key={day} className="px-1 py-2 text-center">
                      {row.marks[
                        `${yearNumber}-${pad(monthNumber)}-${pad(day)}`
                      ] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
