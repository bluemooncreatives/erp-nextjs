// `staffs.report_print` - StaffController@report_print,
// `backEnd.staffs.print_view`.
//
// Despite the name this is not a staff profile: the Blade looks up the chart
// account whose `contactable` is that staff member's user and prints its
// approved transactions as a running statement, opening with the staff's
// `opening_balance`.
//
// The Blade's `$transactions` was only set when the account had any, and the
// closing "Current Balance" row sat inside that `@isset`, so an account with
// no transactions printed the opening row alone. That is preserved.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findStaff } from '@/lib/hr/staff';
import { findContactAccount } from '@/lib/accounting/accounts';
import { ledgerRows } from '@/lib/reports/statements';
import { MorphType } from '@/lib/db/morph';
import { dateConvert, formatPrice, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PrintButton } from '@/components/erp/print-button';
import { DataTable, Td, Tr } from '@/components/erp/table';

export const metadata: Metadata = { title: 'Report Print' };

export default async function StaffReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const found = await findStaff(Number(id));
  if (!found) notFound();

  const setting = await generalSetting();
  const account = await findContactAccount(found.user.id, MorphType.User);

  // `$chartAccount->transactions()->Approved()` - the approved leg only.
  const all = account ? await ledgerRows(account.id, null, null) : [];
  const transactions = all.filter((row) => row.isApprove === 1);

  // `$currentBalance = 0 + $staffDetails->opening_balance`, then debits add and
  // credits subtract as the Blade walked the rows in order.
  //
  // The balances are worked out before any formatting, because the formatting
  // pass awaits and would resume out of order - accumulating inside it gives
  // every row the closing balance.
  const opening = Number(found.staff.openingBalance ?? 0);
  const withBalances = transactions.reduce<
    Array<{ row: (typeof transactions)[number]; balance: number }>
  >((acc, row) => {
    const previous = acc.length ? acc[acc.length - 1].balance : opening;
    const signed = row.type === 'Cr' ? -Number(row.amount) : Number(row.amount);
    acc.push({ row, balance: previous + signed });
    return acc;
  }, []);

  const rows = await Promise.all(
    withBalances.map(async ({ row, balance }) => ({
      ...row,
      dateLabel: row.date ? await dateConvert(row.date) : '',
      balance,
    })),
  );
  const closing = withBalances.length
    ? withBalances[withBalances.length - 1].balance
    : opening;

  const logo = assetUrl(setting.logo);

  // `single_price()`, with the setting already loaded.
  const money = (value: number) => formatPrice(value, setting.currencySymbol);

  const printedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

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
        <dt className="font-semibold">Phone</dt>
        <dd>{setting.phone ?? '-'}</dd>
        <dt className="font-semibold">Email</dt>
        <dd>{setting.email ?? '-'}</dd>
        <dt className="font-semibold">Account Name</dt>
        <dd>{account?.name ?? found.user.name ?? '-'}</dd>
        <dt className="font-semibold">Print</dt>
        <dd>{printedAt}</dd>
      </dl>

      <DataTable
        columns={[
          { label: 'Date' },
          { label: 'Description' },
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
          <Td className="text-end">{money(opening)}</Td>
        </Tr>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td>{row.dateLabel}</Td>
            <Td>{row.voucherNarration ?? row.narration ?? ''}</Td>
            <Td>{row.type === 'Dr' ? money(Number(row.amount)) : ''}</Td>
            <Td>{row.type === 'Cr' ? money(Number(row.amount)) : ''}</Td>
            <Td className="text-end">{money(row.balance)}</Td>
          </Tr>
        ))}
        {transactions.length > 0 ? (
          <Tr>
            <Td>Current Balance</Td>
            <Td />
            <Td />
            <Td />
            <Td className="text-end">{money(closing)}</Td>
          </Tr>
        ) : null}
      </DataTable>
    </>
  );
}
