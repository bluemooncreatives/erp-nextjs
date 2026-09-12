// Contra vouchers - port of ContraVoucherController@index.
// A main account against one or more opposite-side accounts, as in Laravel.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

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
    paymentType: 'contra_voucher',
    page: Number(sp.page ?? 1),
  });

  const canCreate = await can('contra.store');
  const canEdit = await can('contra.edit');

  const voucherRows = await Promise.all(
    rows.map(async (v) => ({ ...v, dateLabel: await dateConvert(v.date) })),
  );

  return (
    <>
      <PageHeader
        title="Contra Vouchers"
        breadcrumb={[{ label: 'Accounts'}, { label:'Contra Voucher' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['contra.create']}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
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
            { label: 'Actions' },
          ]}
          isEmpty={voucherRows.length === 0}
          empty="No contra vouchers found."
        >
          {voucherRows.map((voucher) => {
            const from = voucher.legs.filter((l) => l.type === 'Cr').map((leg) => leg.accountName).join(',');
            const to = voucher.legs.filter((l) => l.type === 'Dr').map((leg) => leg.accountName).join(',');
            return (
              <Tr key={voucher.id}>
                <Td className="font-medium text-foreground">
                  {voucher.txId ?? voucher.id}
                </Td>
                <Td>{voucher.dateLabel}</Td>
                <Td>{from || '-'}</Td>
                <Td>{to || '-'}</Td>
                <Td>{`${symbol} ${numberFormat(voucher.amount)}`}</Td>
                <Td>
                  <Badge size="sm" color={voucher.isApprove === 1 ? 'success' : 'warning'}>
                    {voucher.isApprove === 1 ? 'Approved':'Pending'}
                  </Badge>
                </Td>
                <Td>{canEdit ? <Link className="text-primary" href={route('contra.edit', { id: voucher.id })}>Edit</Link> : '-'}</Td>
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
