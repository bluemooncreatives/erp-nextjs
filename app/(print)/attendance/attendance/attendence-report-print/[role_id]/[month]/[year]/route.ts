// `attendance_report_print` - AttendanceReportController@attendance_report_print.
// The controller streamed this as a landscape PDF; dompdf has no equivalent
// here, so it now renders one directly, landscape to fit a month's columns.

import { requireUser } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { roles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { attendanceReport } from '@/lib/hr/leave';
import { generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import type { Content } from '@/lib/pdf/build';
import { RULED_TABLE, companyHeader, pdfResponse } from '@/lib/pdf/build';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ role_id: string; month: string; year: string }> },
) {
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

  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const pad = (value: number) => String(value).padStart(2, '0');

  const content: Content[] = [
    companyHeader({
      name: setting.companyName ?? null,
      phone: setting.phone ?? null,
      email: setting.email ?? null,
      address: setting.address ?? null,
      logoUrl: assetUrl(setting.logo),
    }),
    { text: 'Staff Attendance', style: 'h1' },
    {
      text: [role?.name, MONTHS[monthNumber - 1], String(yearNumber)].filter(Boolean).join(' - '),
      style: 'muted',
      margin: [0, 0, 0, 12],
    },
  ];

  if (report.length === 0) {
    content.push({ text: 'No attendance recorded for this period.', style: 'muted' });
  } else {
    const body: Content[][] = [
      [
        { text: 'Staff', style: 'tableHeader' },
        ...days.map((day): Content => ({ text: String(day), style: 'tableHeader', alignment: 'center' })),
      ],
      ...report.map((row): Content[] => [
        row.userName ?? '-',
        ...days.map((day): Content => ({
          text: row.marks[`${yearNumber}-${pad(monthNumber)}-${pad(day)}`] ?? '',
          alignment: 'center',
        })),
      ]),
    ];

    content.push({
      table: { headerRows: 1, widths: ['auto', ...days.map(() => 16)], body },
      layout: RULED_TABLE,
      fontSize: 7,
    });
  }

  return pdfResponse(
    { content, pageOrientation: 'landscape', pageSize: 'A4', defaultStyle: { font: 'Roboto', fontSize: 8 } },
    `Attendance-${role?.name ?? role_id}-${month}-${year}.pdf`,
  );
}
