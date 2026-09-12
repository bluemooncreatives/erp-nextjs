// Journal vouchers - port of JournalController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import Badge from '@/components/ui/badge/Badge';

export const metadata: Metadata = { title: 'Journal Vouchers' };

export default async function JournalVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await authorize('journal.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listVouchers({
    paymentType: 'journal_voucher',
    page: Number(sp.page ?? 1),
  });

  const canCreate = await can('journal.store');

  const voucherRows = await Promise.all(
    rows.map(async (v) => ({ ...v, dateLabel: await dateConvert(v.date) })),
  );

  return (
    <>
      <PageHeader
        title="Journal Vouchers"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Journal' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['journal.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Journal
            </Link>
          ) : null
        }
      />

      <Card title={`Journal vouchers (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Voucher' },
            { label: 'Date' },
            { label: 'Postings' },
            { label: 'Amount' },
            { label: 'Approval' },
          ]}
          isEmpty={voucherRows.length === 0}
          empty="No journal vouchers found."
        >
          {voucherRows.map((voucher) => (
            <Tr key={voucher.id}>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {voucher.txId ?? voucher.id}
              </Td>
              <Td>{voucher.dateLabel}</Td>
              <Td className="max-w-sm">
                {voucher.legs.map((leg, i) => (
                  <span key={i} className="block text-theme-xs">
                    {leg.type}: {leg.accountName} {symbol} {numberFormat(leg.amount)}
                  </span>
                ))}
              </Td>
              <Td>{`${symbol} ${numberFormat(voucher.amount)}`}</Td>
              <Td>
                <Badge size="sm" color={voucher.isApprove === 1 ? 'success' : 'warning'}>
                  {voucher.isApprove === 1 ? 'Approved' : 'Pending'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['journal.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
