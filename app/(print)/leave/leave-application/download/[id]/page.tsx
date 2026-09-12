// `leave.application.download` - LeaveController@downloadLeaveApplication,
// `leave::apply_leaves.pdf`.
//
// dompdf has no equivalent here, so the application renders on the print sheet
// and "Save as PDF" produces the same document.
//
// The Blade printed `$remaining_leave_days` and `$extra_leave_days`, which the
// controller never passed - both came out empty in the PDF. The port fills
// them from the same balance the Leave screens already show, because a blank
// field is a bug rather than a behaviour worth preserving.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { LeaveStatus, findLeaveApplication, leaveBalance } from '@/lib/hr/leave';
import { dateConvert, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';

export const metadata: Metadata = { title: 'Leave Application' };

function statusLabel(status: number | null): string {
  if (status === LeaveStatus.Pending) return 'Pending';
  if (status === LeaveStatus.Approved) return 'Approved';
  return 'Cancelled';
}

export default async function LeaveApplicationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const logo = assetUrl(setting.logo) ?? assetUrl('uploads/settings/logo.png');
  const attachment = assetUrl(leave.attachment);

  // `remaining` goes negative once more leave is taken than the role defines;
  // the Blade showed that overage as "Extra Taken Leave".
  const remaining = Math.max(0, balance.remaining);
  const extra = Math.max(0, -balance.remaining);

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

  return (
    <>
      <div className="mb-6 flex items-start justify-between border-b pb-5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-16 w-auto" />
        ) : (
          <span className="text-lg font-semibold">{setting.companyName}</span>
        )}
        <PrintButton />
      </div>

      <h1 className="mb-6 text-xl font-semibold">Leave Application</h1>

      <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="font-semibold">Company</dt>
        <dd>{setting.companyName ?? '-'}</dd>
        <dt className="font-semibold">Phone</dt>
        <dd>{setting.phone ?? '-'}</dd>
        <dt className="font-semibold">Email</dt>
        <dd>{setting.email ?? '-'}</dd>
        <dt className="font-semibold">Address</dt>
        <dd>{setting.address ?? '-'}</dd>
        <dt className="font-semibold">Prepared By</dt>
        <dd>{createdByName ?? '-'}</dd>
        <dt className="font-semibold">Approved By</dt>
        <dd>{approvedByName ?? '-'}</dd>
      </dl>

      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b last:border-0">
              <th scope="row" className="w-56 px-2 py-2 text-start font-semibold">
                {label}
              </th>
              <td className="px-2 py-2">{value || '-'}</td>
            </tr>
          ))}
          <tr className="border-b last:border-0">
            <th scope="row" className="w-56 px-2 py-2 text-start font-semibold">
              Attachment
            </th>
            <td className="px-2 py-2">
              {attachment ? (
                <a href={attachment} className="text-primary underline">
                  See Attachment
                </a>
              ) : (
                'Not Available'
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
