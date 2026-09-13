// `leave.application.download` - LeaveController@downloadLeaveApplication.
// dompdf produced a file here; this now does too.
//
// The Blade printed `$remaining_leave_days` and `$extra_leave_days`, which the
// controller never passed - both came out empty in the PDF. This fills them
// from the same balance the Leave screens already show, because a blank
// field is a bug rather than a behaviour worth preserving.

import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { LeaveStatus, findLeaveApplication, leaveBalance } from '@/lib/hr/leave';
import { dateConvert, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import type { Content } from '@/lib/pdf/build';
import { RULED_TABLE, companyHeader, pdfResponse } from '@/lib/pdf/build';

function statusLabel(status: number | null): string {
  if (status === LeaveStatus.Pending) return 'Pending';
  if (status === LeaveStatus.Approved) return 'Approved';
  return 'Cancelled';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const found = await findLeaveApplication(Number(id));
  if (!found) notFound();

  const { leave, userName, userEmail, leaveTypeName, approvedByName, createdByName } = found;

  const [setting, balance, startLabel, endLabel, applyLabel] = await Promise.all([
    generalSetting(),
    leaveBalance(leave.userId),
    dateConvert(leave.startDate),
    leave.endDate ? dateConvert(leave.endDate) : Promise.resolve('-'),
    dateConvert(leave.applyDate),
  ]);

  const remaining = Math.max(0, balance.remaining);
  const extra = Math.max(0, -balance.remaining);
  const attachmentPath = assetUrl(leave.attachment);
  const attachmentUrl = attachmentPath ? new URL(attachmentPath, request.url).toString() : null;

  const rows: Array<[string, string]> = [
    ['Type', leaveTypeName ?? '-'],
    ['Staff', userName ?? '-'],
    ['Email', userEmail ?? '-'],
    ['From', startLabel],
    ['To', endLabel],
    ['Apply Date', applyLabel],
    ['Status', statusLabel(leave.status)],
    ['Approved By', approvedByName ?? ''],
    ['Reason', leave.reason ?? ''],
    ['Total Leave', `${balance.taken} Days`],
    ['Remaining Total Leave', `${remaining} Days`],
    ['Extra Taken Leave', `${extra} Days`],
  ];

  const content: Content[] = [
    companyHeader({
      name: setting.companyName ?? null,
      phone: setting.phone ?? null,
      email: setting.email ?? null,
      address: setting.address ?? null,
      logoUrl: assetUrl(setting.logo),
    }),
    { text: 'Leave Application', style: 'h1', margin: [0, 0, 0, 10] },
    {
      columns: [
        { width: 'auto', text: 'Prepared By: ', bold: true },
        { width: '*', text: createdByName ?? '-' },
        { width: 'auto', text: 'Approved By: ', bold: true },
        { width: '*', text: approvedByName ?? '-' },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      table: {
        widths: [140, '*'],
        body: [
          ...rows.map(([label, value]): Content[] => [{ text: label, bold: true }, value || '-']),
          [
            { text: 'Attachment', bold: true },
            attachmentUrl
              ? { text: 'See Attachment', color: '#2563eb', decoration: 'underline', link: attachmentUrl }
              : 'Not Available',
          ],
        ],
      },
      layout: RULED_TABLE,
    },
  ];

  return pdfResponse({ content }, `Leave-Application-${id}.pdf`);
}
