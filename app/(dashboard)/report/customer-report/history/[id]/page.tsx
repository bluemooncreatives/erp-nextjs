// Customer history - port of CustomerReportController@showHistory
// (`report::customer_report.history`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findContact, toNumber } from '@/lib/contact/queries';
import { contactableLedger } from '@/lib/reports/statements';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { PlayCircle, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { LedgerTable } from '@/components/erp/ledger-table';
import { LinkButton } from '@/components/common/link-button';
import { route } from '@/lib/routes';

export const metadata: Metadata = { title: 'Customer History' };

export default async function CustomerHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('customer_report.history');
  const { id } = await params;

  const contact = await findContact(Number(id));
  if (!contact) notFound();

  const ledger = await contactableLedger(
    MorphType.ContactModel,
    contact.id,
    toNumber(contact.openingBalance),
  );

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
        title={`Customer History - ${contact.name}`}
        breadcrumb={[{ label: 'Reports' }, { label: 'Customer History' }]}
        actions={
          <LinkButton href={route('customer_report.print', { id: contact.id })} target="_blank" variant="outline">
            Print
          </LinkButton>
        }
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
        title={contact.name}
        openingLabel={openingLabel}
        rows={rows}
      />
    </>
  );
}
