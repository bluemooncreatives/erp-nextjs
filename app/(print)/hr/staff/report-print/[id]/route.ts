// `staffs.report_print` - StaffController@report_print. Despite the name this
// is not a staff profile: it is a running statement of the chart account
// whose `contactable` is that staff member's user, opening with the staff's
// `opening_balance`. dompdf produced a file here; this now does too.

import { notFound } from 'next/navigation';
import { findStaff } from '@/lib/hr/staff';
import { findContactAccount } from '@/lib/accounting/accounts';
import { ledgerRows } from '@/lib/reports/statements';
import { MorphType } from '@/lib/db/morph';
import { requireUser } from '@/lib/auth/permissions';
import { dateConvert, formatPrice, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import type { Content } from '@/lib/pdf/build';
import { RULED_TABLE, companyHeader, pdfResponse } from '@/lib/pdf/build';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const found = await findStaff(Number(id));
  if (!found) notFound();

  const setting = await generalSetting();
  const account = await findContactAccount(found.user.id, MorphType.User);

  const all = account ? await ledgerRows(account.id, null, null) : [];
  const transactions = all.filter((row) => row.isApprove === 1);

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
  const closing = withBalances.length ? withBalances[withBalances.length - 1].balance : opening;

  const money = (value: number) => formatPrice(value, setting.currencySymbol);
  const printedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const body: Content[][] = [
    [
      { text: 'Date', style: 'tableHeader' },
      { text: 'Description', style: 'tableHeader' },
      { text: 'Debit', style: 'tableHeader', alignment: 'right' },
      { text: 'Credit', style: 'tableHeader', alignment: 'right' },
      { text: 'Balance', style: 'tableHeader', alignment: 'right' },
    ],
    ['Openning Balance', '', '', '', { text: money(opening), alignment: 'right' }],
    ...rows.map((row): Content[] => [
      row.dateLabel,
      row.voucherNarration ?? row.narration ?? '',
      { text: row.type === 'Dr' ? money(Number(row.amount)) : '', alignment: 'right' },
      { text: row.type === 'Cr' ? money(Number(row.amount)) : '', alignment: 'right' },
      { text: money(row.balance), alignment: 'right' },
    ]),
    ...(transactions.length > 0
      ? [
          [
            { text: 'Current Balance', bold: true },
            '',
            '',
            '',
            { text: money(closing), bold: true, alignment: 'right' },
          ] as Content[],
        ]
      : []),
  ];

  const content: Content[] = [
    companyHeader({
      name: setting.companyName ?? null,
      phone: setting.phone ?? null,
      email: setting.email ?? null,
      address: setting.address ?? null,
      logoUrl: assetUrl(setting.logo),
    }),
    {
      text: [
        { text: 'Account: ', bold: true },
        account?.name ?? found.user.name ?? '-',
        '   ',
        { text: 'Printed: ', bold: true },
        printedAt,
      ],
      margin: [0, 0, 0, 12],
    },
    { table: { widths: ['auto', '*', 'auto', 'auto', 'auto'], body }, layout: RULED_TABLE },
  ];

  return pdfResponse({ content }, `Staff-Statement-${id}.pdf`);
}
