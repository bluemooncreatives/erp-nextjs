// Ledger report - port of LedgerReportController@index
// (`report::leadger_report.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize } from '@/lib/auth/permissions';
import { ledgerAccounts } from '@/lib/reports/statements';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ledgerStatement } from '@/lib/reports/ledger';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { ArrowDownLeft, ArrowUpRight, PlayCircle, Scale } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { FormAlert } from '@/components/erp/fields';
import { SelectControl } from '@/components/erp/select-control';

export const metadata: Metadata = { title: 'Ledger Report' };

export default async function LedgerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string; dateFrom?: string; dateTo?: string }>;
}) {
  await authorize('leadger_report.index');
  const sp = await searchParams;

  const accounts = await ledgerAccounts();
  const { accountId, account, from, to, warning, rows, withBalances, opening, closing, totalDebit, totalCredit } =
    await ledgerStatement(sp);

  const decorated = await Promise.all(
    withBalances.map(async ({ row, amount, balance }) => ({
      ...row,
      amount,
      balance,
      dateLabel: await dateConvert(row.date ?? row.createdAt),
      debitLabel: row.type === 'Dr' ? await singlePrice(amount) : '',
      creditLabel: row.type === 'Cr' ? await singlePrice(amount) : '',
      balanceLabel: await singlePrice(balance),
    })),
  );


  // Opening and closing bracket the period; the Dr/Cr totals say how it got
  // from one to the other. The table alone made you scroll to the last row to
  // find the closing balance.
  const [openingLabel, closingLabel, debitLabel, creditLabel] = await Promise.all([
    singlePrice(opening),
    singlePrice(closing),
    singlePrice(totalDebit),
    singlePrice(totalCredit),
  ]);

  return (
    <>
      <PageHeader
        title="Ledger Report"
        breadcrumb={[{ label: 'Reports' }, { label: 'Ledger Report' }]}
        actions={
          <form
            action={ROUTES['leadger_report.index']}
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <SelectControl
              name="account_id"
              defaultValue={accountId ? String(accountId) : ''}
              placeholder="Select account"
              aria-label="Account"
              options={accounts.map((a) => ({
                value: String(a.id),
                label: a.name + (a.code ? ' (' + a.code + ')' : ''),
              }))}
              className="sm:w-72"
            />
            <input
              type="date"
              name="dateFrom"
              defaultValue={from ?? ''}
              className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
            />
            <input
              type="date"
              name="dateTo"
              defaultValue={to ?? ''}
              className="h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary"
            >
              Search
            </button>
          </form>
        }
      />

      {warning ? (
        <div className="mb-5">
          <FormAlert variant="warning" message={warning} />
        </div>
      ) : null}

      {!account ? (
        <Card title="Ledger">
          <EmptyState message="Select an account to build its ledger." />
        </Card>
      ) : (
        <>
        <ReportSummary
          figures={[
            { label: 'Opening balance', value: openingLabel, detail: 'Brought forward', icon: PlayCircle },
            { label: 'Debits', value: debitLabel, detail: 'Dr in this period', icon: ArrowDownLeft },
            { label: 'Credits', value: creditLabel, detail: 'Cr in this period', icon: ArrowUpRight },
            { label: 'Closing balance', value: closingLabel, detail: `After ${rows.length} postings`, icon: Scale },
          ]}
        />

        <Card
          title={`${account.name}${account.code ? ` (${account.code})` : ''}`}
          bodyClassName=""
          actions={
            <Link
              href={`${route('leadger_report.print_view', { slug: account.id })}?${new URLSearchParams(
                { account_id: String(account.id), ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) },
              )}`}
              className="text-xs font-medium text-primary hover:text-primary"
            >
              Print view
            </Link>
          }
        >
          <DataTable
            columns={[
              { label: 'Date' },
              { label: 'Voucher' },
              { label: 'Narration' },
              { label: 'Debit' },
              { label: 'Credit' },
              { label: 'Balance' },
            ]}
            isEmpty={false}
          >
            <Tr>
              <Td className="font-medium text-foreground">
                Opening Balance
              </Td>
              <Td />
              <Td />
              <Td />
              <Td />
              <Td className="text-right">{openingLabel}</Td>
            </Tr>

            {decorated.map((row) => (
              <Tr key={row.id}>
                <Td>{row.dateLabel}</Td>
                <Td>{row.txId ?? '-'}</Td>
                <Td>{row.narration ?? row.voucherNarration ?? '-'}</Td>
                <Td>{row.debitLabel}</Td>
                <Td>{row.creditLabel}</Td>
                <Td className="text-right">{row.balanceLabel}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
        </>
      )}
    </>
  );
}
