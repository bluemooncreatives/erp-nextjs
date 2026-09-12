// Payment vouchers - port of VoucherController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { deleteVoucherAction } from '../../actions';

export const metadata: Metadata = { title: 'Payment Vouchers' };

export default async function PaymentVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await authorize('vouchers.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listVouchers({
    paymentType: 'voucher_payment',
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canDelete, canEdit, canView] = await Promise.all([
    can('vouchers.store'),
    can('vouchers.destroy'),
    can('vouchers.edit'),
    can('vouchers.show'),
  ]);

  const voucherRows = await Promise.all(
    rows.map(async (v) => ({ ...v, dateLabel: await dateConvert(v.date) })),
  );

  return (
    <>
      <PageHeader
        title="Payment Vouchers"
        breadcrumb={[{ label: 'Accounts'}, { label:'Payment Vouchers' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['vouchers.create']}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
            >
              Add Voucher
            </Link>
          ) : null
        }
      />

      <Card title={`Vouchers (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Voucher' },
            { label: 'Date' },
            { label: 'Type' },
            { label: 'Accounts' },
            { label: 'Amount' },
            { label: 'Approval' },
            { label: 'Action' },
          ]}
          isEmpty={voucherRows.length === 0}
          empty="No payment vouchers found."
        >
          {voucherRows.map((voucher) => (
            <Tr key={voucher.id}>
              <Td className="font-medium text-foreground">
                {canView ? <Link href={route('vouchers.show', { id: voucher.id })} className="text-primary">{voucher.txId ?? voucher.id}</Link> : voucher.txId ?? voucher.id}
              </Td>
              <Td>{voucher.dateLabel}</Td>
              <Td>{voucher.voucherType}</Td>
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
                  {voucher.isApprove === 1
                    ? 'Approved'
                    : voucher.isApprove === 2
                      ? 'Cancelled'
                      : 'Pending'}
                </Badge>
              </Td>
              <Td>
                {canEdit ? <Link href={route('vouchers.edit', { id: voucher.id })} className="mr-3 text-primary">Edit</Link> : null}
                {canDelete ? (
                  <form action={deleteVoucherAction}>
                    <input type="hidden" name="id" value={voucher.id} />
                    <ActionButton confirm="Delete this voucher and its postings?">
                      Delete
                    </ActionButton>
                  </form>
                ) : (
                  '-'
                )}
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['vouchers.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
