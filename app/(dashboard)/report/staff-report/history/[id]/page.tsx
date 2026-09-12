// Staff history - port of StaffReportController@showHistory
// (`report::staff_report.history`).

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findStaff } from '@/lib/hr/staff';
import { contactableLedger } from '@/lib/reports/statements';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { LedgerTable } from '@/components/erp/ledger-table';

export const metadata: Metadata = { title: 'Staff History' };

export default async function StaffHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('staff_report.history');
  const { id } = await params;

  const staff = await findStaff(Number(id));
  if (!staff) notFound();

  const ledger = await contactableLedger(
    MorphType.User,
    staff.user.id,
    Number(staff.staff.openingBalance ?? 0),
  );

  // The controller bounced back for the super admin or an account-less staff.
  if (staff.user.roleId === 1 || !ledger.account) {
    redirect(ROUTES['staff_report.index']);
  }

  const rows = await Promise.all(
    ledger.rows.map(async (row) => ({
      id: row.id,
      dateLabel: await dateConvert(row.date ?? row.createdAt),
      reference: row.txId ?? '-',
      narration: row.narration ?? row.voucherNarration ?? '-',
      debitLabel: row.type === 'Dr' ? await singlePrice(row.amount) : '',
      creditLabel: row.type === 'Cr' ? await singlePrice(row.amount) : '',
      balanceLabel: await singlePrice(row.balance),
    })),
  );

  const [openingLabel, closingLabel] = await Promise.all([
    singlePrice(ledger.opening),
    singlePrice(ledger.closing),
  ]);

  return (
    <>
      <PageHeader
        title={`Staff History - ${staff.user.name}`}
        breadcrumb={[{ label: 'Reports' }, { label: 'Staff History' }]}
      />
      <LedgerTable
        title={staff.user.name}
        desc={`Current balance ${closingLabel}`}
        openingLabel={openingLabel}
        rows={rows}
      />
    </>
  );
}
