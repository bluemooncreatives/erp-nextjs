// `leadger_report.print_view` - LedgerReportController@print_view,
// `report::leadger_report.print_view`.
//
// The controller ignores the `{slug}` segment and reads `account_id`,
// `dateFrom` and `dateTo` from the query string, exactly as `index` does. The
// slug is kept in the URL so existing links resolve, and it stands in for
// `account_id` when the query string does not carry one.

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { ledgerStatement } from '@/lib/reports/ledger';
import { dateConvert, formatPrice, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata: Metadata = { title: 'Ledger Report' };

export default async function LedgerPrintViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ account_id?: string; dateFrom?: string; dateTo?: string }>;
}) {
  await requireUser();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const statement = await ledgerStatement({ ...sp, account_id: sp.account_id ?? slug });
  const { account, from, to, warning, withBalances, opening, closing, totalDebit, totalCredit } =
    statement;

  const setting = await generalSetting();
  const money = (value: number) => formatPrice(value, setting.currencySymbol);
  const logo = assetUrl(setting.logo);

  const rows = await Promise.all(
    withBalances.map(async ({ row, amount, balance }) => ({
      ...row,
      amount,
      balance,
      dateLabel: await dateConvert(row.date ?? row.createdAt),
    })),
  );

  const [fromLabel, toLabel] = await Promise.all([
    from ? dateConvert(from) : Promise.resolve(null),
    to ? dateConvert(to) : Promise.resolve(null),
  ]);

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

      <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="font-semibold">Company</dt>
        <dd>{setting.companyName ?? '-'}</dd>
        <dt className="font-semibold">Account</dt>
        <dd>
          {account
            ? `${account.name}${account.code ? ` (${account.code})` : ''}`
            : 'No account selected'}
        </dd>
        <dt className="font-semibold">Period</dt>
        <dd>{fromLabel && toLabel ? `${fromLabel} - ${toLabel}` : 'All dates'}</dd>
        <dt className="font-semibold">Print</dt>
        <dd>{new Date().toISOString().slice(0, 19).replace('T', ' ')}</dd>
      </dl>

      {warning ? (
        <p className="text-sm font-medium text-destructive">{warning}</p>
      ) : (
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Voucher' },
            { label: 'Narration' },
            { label: 'Debit' },
            { label: 'Credit' },
            { label: 'Balance', align: 'right' },
          ]}
          isEmpty={false}
        >
          <Tr>
            <Td>Openning Balance</Td>
            <Td />
            <Td />
            <Td />
            <Td />
            <Td className="text-right">{money(opening)}</Td>
          </Tr>
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td>{row.txId ?? '-'}</Td>
              <Td>{row.voucherNarration ?? row.narration ?? ''}</Td>
              <Td>{row.type === 'Dr' ? money(row.amount) : ''}</Td>
              <Td>{row.type === 'Cr' ? money(row.amount) : ''}</Td>
              <Td className="text-right">{money(row.balance)}</Td>
            </Tr>
          ))}
          <Tr>
            <Td className="font-semibold">Total</Td>
            <Td />
            <Td />
            <Td className="font-semibold">{money(totalDebit)}</Td>
            <Td className="font-semibold">{money(totalCredit)}</Td>
            <Td className="text-right font-semibold">{money(closing)}</Td>
          </Tr>
        </DataTable>
      )}
    </>
  );
}
