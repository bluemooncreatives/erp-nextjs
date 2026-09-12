import { LinkButton } from '@/components/common/link-button';
// Payment vouchers - port of VoucherController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Files, Wallet, CircleCheck, CircleX, Hourglass } from 'lucide-react';
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

  // An approver scans this list for what is still waiting, so pending leads.
  const pageValue = voucherRows.reduce((sum, v) => sum + Number(v.amount ?? 0), 0);
  const approvedCount = voucherRows.filter((v) => v.isApprove === 1).length;
  const cancelledCount = voucherRows.filter((v) => v.isApprove === 2).length;
  const pendingCount = voucherRows.length - approvedCount - cancelledCount;

  return (
    <>
      <PageHeader
        title="Payment Vouchers"
        breadcrumb={[{ label: 'Accounts'}, { label:'Payment Vouchers' }]}
        actions={
          canCreate ? (
            <LinkButton
              href={ROUTES['vouchers.create']}
              
            >
              Add Voucher
            </LinkButton>
          ) : null
        }
      />

      <ReportSummary
        figures={[
          { label: 'Pending approval', value: pendingCount, detail: 'On this page', icon: Hourglass },
          { label: 'Approved', value: approvedCount, detail: 'On this page', icon: CircleCheck },
          { label: 'Cancelled', value: cancelledCount, detail: 'On this page', icon: CircleX },
          { label: 'Value on this page', value: `${symbol} ${numberFormat(pageValue)}`, detail: `${voucherRows.length} of ${total} records`, icon: Wallet },
          { label: 'Payment vouchers', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Files },
        ]}
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
