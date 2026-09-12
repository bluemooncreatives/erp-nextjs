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
import { ReportSummary } from '@/components/erp/report-summary';
import { PlayCircle, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
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

  // The running balance only tells you where the account ended up; the period's
  // own debit and credit totals say how much moved to get it there.
  const [openingLabel, closingLabel, debitLabel, creditLabel] = await Promise.all([
    singlePrice(ledger.opening),
    singlePrice(ledger.closing),
    singlePrice(ledger.rows.filter((r) => r.type === 'Dr').reduce((sum, r) => sum + Number(r.amount), 0)),
    singlePrice(ledger.rows.filter((r) => r.type === 'Cr').reduce((sum, r) => sum + Number(r.amount), 0)),
  ]);

  return (
    <>
      <PageHeader
        title={`Staff History - ${staff.user.name}`}
        breadcrumb={[{ label: 'Reports' }, { label: 'Staff History' }]}
      />
      <ReportSummary
        figures={[
          { label: 'Opening balance', value: openingLabel, detail: 'Brought forward', icon: PlayCircle },
          { label: 'Debits', value: debitLabel, detail: 'Dr on this account', icon: ArrowDownLeft },
          { label: 'Credits', value: creditLabel, detail: 'Cr on this account', icon: ArrowUpRight },
          { label: 'Current balance', value: closingLabel, detail: `After ${ledger.rows.length} postings`, icon: Scale },
        ]}
      />

      <LedgerTable
        title={staff.user.name}
        openingLabel={openingLabel}
        rows={rows}
      />
    </>
  );
}
