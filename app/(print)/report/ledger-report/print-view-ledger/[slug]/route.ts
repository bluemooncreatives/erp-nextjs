// `leadger_report.print_view` - LedgerReportController@print_view. Ignores
// the `{slug}` segment and reads `account_id`, `dateFrom` and `dateTo` from
// the query string, exactly as `index` does; the slug stands in for
// `account_id` when the query string does not carry one. dompdf produced a
// file here; this now does too.

import { requireUser } from '@/lib/auth/permissions';
import { ledgerStatement } from '@/lib/reports/ledger';
import { dateConvert, formatPrice, generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import type { Content } from '@/lib/pdf/build';
import { RULED_TABLE, companyHeader, pdfResponse } from '@/lib/pdf/build';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  await requireUser();
  const { slug } = await params;
  const sp = new URL(request.url).searchParams;

  const statement = await ledgerStatement({
    account_id: sp.get('account_id') ?? slug,
    dateFrom: sp.get('dateFrom') ?? undefined,
    dateTo: sp.get('dateTo') ?? undefined,
  });
  const { account, from, to, warning, withBalances, opening, closing, totalDebit, totalCredit } =
    statement;

  const setting = await generalSetting();
  const money = (value: number) => formatPrice(value, setting.currencySymbol);

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
        account ? `${account.name}${account.code ? ` (${account.code})` : ''}` : 'No account selected',
        '   ',
        { text: 'Period: ', bold: true },
        fromLabel && toLabel ? `${fromLabel} - ${toLabel}` : 'All dates',
      ],
      margin: [0, 0, 0, 12],
    },
  ];

  if (warning) {
    content.push({ text: warning, color: '#b91c1c', bold: true });
  } else {
    const body: Content[][] = [
      [
        { text: 'Date', style: 'tableHeader' },
        { text: 'Voucher', style: 'tableHeader' },
        { text: 'Narration', style: 'tableHeader' },
        { text: 'Debit', style: 'tableHeader', alignment: 'right' },
        { text: 'Credit', style: 'tableHeader', alignment: 'right' },
        { text: 'Balance', style: 'tableHeader', alignment: 'right' },
      ],
      ['Openning Balance', '', '', '', '', { text: money(opening), alignment: 'right' }],
      ...rows.map((row): Content[] => [
        row.dateLabel,
        row.txId ?? '-',
        row.voucherNarration ?? row.narration ?? '',
        { text: row.type === 'Dr' ? money(row.amount) : '', alignment: 'right' },
        { text: row.type === 'Cr' ? money(row.amount) : '', alignment: 'right' },
        { text: money(row.balance), alignment: 'right' },
      ]),
      [
        { text: 'Total', bold: true },
        '',
        '',
        { text: money(totalDebit), bold: true, alignment: 'right' },
        { text: money(totalCredit), bold: true, alignment: 'right' },
        { text: money(closing), bold: true, alignment: 'right' },
      ],
    ];
    content.push({
      table: { widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto'], body },
      layout: RULED_TABLE,
    });
  }

  return pdfResponse({ content }, `Ledger-${slug}.pdf`);
}
