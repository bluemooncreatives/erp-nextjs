// Supplier history - port of SupplierReportController@showHistory
// (`report::supplier_report.history`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findContact, toNumber } from '@/lib/contact/queries';
import { contactableLedger } from '@/lib/reports/statements';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, singlePrice } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { LedgerTable } from '@/components/erp/ledger-table';

export const metadata: Metadata = { title: 'Supplier History' };

export default async function SupplierHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('supplier_report.history');
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

  const [openingLabel, closingLabel] = await Promise.all([
    singlePrice(ledger.opening),
    singlePrice(ledger.closing),
  ]);

  return (
    <>
      <PageHeader
        title={`Supplier History - ${contact.name}`}
        breadcrumb={[{ label: 'Reports' }, { label: 'Supplier History' }]}
      />
      <LedgerTable
        title={contact.name}
        desc={`Current balance ${closingLabel}`}
        openingLabel={openingLabel}
        rows={rows}
      />
    </>
  );
}
