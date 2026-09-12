// Contra vouchers - port of ContraVoucherController@index.
// A contra voucher moves money between two of the business's own accounts.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import Badge from '@/components/ui/badge/Badge';

export const metadata: Metadata = { title: 'Contra Vouchers' };

export default async function ContraVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await authorize('contra.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listVouchers({
    voucherType: 'CRV',
    page: Number(sp.page ?? 1),
  });

  const canCreate = await can('contra.store');

  const voucherRows = await Promise.all(
    rows.map(async (v) => ({ ...v, dateLabel: await dateConvert(v.date) })),
  );

  return (
    <>
      <PageHeader
        title="Contra Vouchers"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Contra Voucher' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['contra.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Contra Voucher
            </Link>
          ) : null
        }
      />

      <Card title={`Contra vouchers (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Voucher' },
            { label: 'Date' },
            { label: 'From' },
            { label: 'To' },
            { label: 'Amount' },
            { label: 'Approval' },
          ]}
          isEmpty={voucherRows.length === 0}
          empty="No contra vouchers found."
        >
          {voucherRows.map((voucher) => {
            const from = voucher.legs.find((l) => l.type === 'Cr');
            const to = voucher.legs.find((l) => l.type === 'Dr');
            return (
              <Tr key={voucher.id}>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {voucher.txId ?? voucher.id}
                </Td>
                <Td>{voucher.dateLabel}</Td>
                <Td>{from?.accountName ?? '-'}</Td>
                <Td>{to?.accountName ?? '-'}</Td>
                <Td>{`${symbol} ${numberFormat(voucher.amount)}`}</Td>
                <Td>
                  <Badge size="sm" color={voucher.isApprove === 1 ? 'success' : 'warning'}>
                    {voucher.isApprove === 1 ? 'Approved' : 'Pending'}
                  </Badge>
                </Td>
              </Tr>
            );
          })}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['contra.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
