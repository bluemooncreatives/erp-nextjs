import { LinkButton } from '@/components/common/link-button';
// Contra vouchers - port of ContraVoucherController@index.
// A main account against one or more opposite-side accounts, as in Laravel.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Files, Wallet, CircleCheck, Hourglass } from 'lucide-react';
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

  // An approver scans this list for what is still waiting, so pending leads.
  const pageValue = voucherRows.reduce((sum, v) => sum + Number(v.amount ?? 0), 0);
  const approvedCount = voucherRows.filter((v) => v.isApprove === 1).length;
  const pendingCount = voucherRows.length - approvedCount;

  return (
    <>
      <PageHeader
        title="Contra Vouchers"
        breadcrumb={[{ label: 'Accounts'}, { label:'Contra Voucher' }]}
        actions={
          canCreate ? (
            <LinkButton
              href={ROUTES['contra.create']}
              
            >
              Add Contra Voucher
            </LinkButton>
          ) : null
        }
      />

      <ReportSummary
        figures={[
          { label: 'Pending approval', value: pendingCount, detail: 'On this page', icon: Hourglass },
          { label: 'Approved', value: approvedCount, detail: 'On this page', icon: CircleCheck },
          { label: 'Value on this page', value: `${symbol} ${numberFormat(pageValue)}`, detail: `${voucherRows.length} of ${total} records`, icon: Wallet },
          { label: 'Contra vouchers', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Files },
        ]}
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
