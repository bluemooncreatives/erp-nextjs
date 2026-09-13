// Customer history print view - port of CustomerReportController@showHistory's
// `$request->has('print')` branch (`report::customer_report.print_view`).
//
// The dashboard history screen (`customer_report.history`) is the same data;
// this is the chrome-less version for the browser's print dialog, the way
// every other "Print" button in this port opens a page under `(print)/`
// rather than a query parameter on the dashboard route.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findContact, toNumber } from '@/lib/contact/queries';
import { contactableLedger } from '@/lib/reports/statements';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, generalSetting, singlePrice } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';
import { PrintHeader, PrintTotals } from '@/components/erp/print-invoice';

export const metadata: Metadata = { title: 'Customer History' };

export default async function CustomerHistoryPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('customer_report.history');
  const { id } = await params;

  const contact = await findContact(Number(id));
  if (!contact) notFound();

  const [ledger, setting] = await Promise.all([
    contactableLedger(MorphType.ContactModel, contact.id, toNumber(contact.openingBalance)),
    generalSetting(),
  ]);

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

  const [openingLabel, closingLabel, debitLabel, creditLabel] = await Promise.all([
    singlePrice(ledger.opening),
    singlePrice(ledger.closing),
    singlePrice(ledger.rows.filter((r) => r.type === 'Dr').reduce((sum, r) => sum + Number(r.amount), 0)),
    singlePrice(ledger.rows.filter((r) => r.type === 'Cr').reduce((sum, r) => sum + Number(r.amount), 0)),
  ]);

  return (
    <>
      <PrintButton />

      <PrintHeader
        company={{
          name: setting.companyName ?? setting.siteTitle ?? '',
          phone: setting.phone ?? '',
          email: setting.email ?? '',
          address: setting.address ?? '',
          logoUrl: assetUrl(setting.logo),
        }}
      />

      <h1 className="mt-5 text-lg font-semibold text-gray-900">Customer History - {contact.name}</h1>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-start">
            <th className="py-2 text-start">Date</th>
            <th className="text-start">Reference</th>
            <th className="text-start">Description</th>
            <th className="text-end">Debit</th>
            <th className="text-end">Credit</th>
            <th className="text-end">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-2 font-medium" colSpan={5}>Opening Balance</td>
            <td className="text-end">{openingLabel}</td>
          </tr>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-200">
              <td className="py-2">{row.dateLabel}</td>
              <td>{row.reference}</td>
              <td>{row.narration}</td>
              <td className="text-end">{row.debitLabel}</td>
              <td className="text-end">{row.creditLabel}</td>
              <td className="text-end">{row.balanceLabel}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-center text-gray-500">No transactions.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <PrintTotals
        rows={[
          { label: 'Opening balance', value: openingLabel },
          { label: 'Debits', value: debitLabel },
          { label: 'Credits', value: creditLabel },
          { label: 'Current balance', value: closingLabel, strong: true },
        ]}
      />
    </>
  );
}
