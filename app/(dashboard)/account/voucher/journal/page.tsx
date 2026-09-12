// Journal vouchers - port of JournalController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

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
  const canEdit = await can('journal.edit');

  const voucherRows = await Promise.all(
    rows.map(async (v) => ({ ...v, dateLabel: await dateConvert(v.date) })),
  );

  return (
    <>
      <PageHeader
        title="Journal Vouchers"
        breadcrumb={[{ label: 'Accounts'}, { label:'Journal' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['journal.create']}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
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
            { label: 'Actions' },
          ]}
          isEmpty={voucherRows.length === 0}
          empty="No journal vouchers found."
        >
          {voucherRows.map((voucher) => (
            <Tr key={voucher.id}>
              <Td className="font-medium text-foreground">
                {voucher.txId ?? voucher.id}
              </Td>
              <Td>{voucher.dateLabel}</Td>
              <Td className="max-w-sm">
                {voucher.legs.map((leg, i) => (
                  <span key={i} className="block text-xs">
                    {leg.type}: {leg.accountName} {symbol} {numberFormat(leg.amount)}
                  </span>
                ))}
              </Td>
              <Td>{`${symbol} ${numberFormat(voucher.amount)}`}</Td>
              <Td>
                <Badge size="sm" color={voucher.isApprove === 1 ? 'success' : 'warning'}>
                  {voucher.isApprove === 1 ? 'Approved':'Pending'}
                </Badge>
              </Td>
              <Td>{canEdit ? <Link className="text-primary" href={route('journal.edit', { id: voucher.id })}>Edit</Link> : '-'}</Td>
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
