import { LinkButton } from '@/components/common/link-button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { ReportSummary } from '@/components/erp/report-summary';
import { Files, Wallet, CircleCheck, CircleX, Hourglass } from 'lucide-react';
import { deleteVoucherAction } from '../../actions';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Receipt Vouchers' };

export default async function ReceiptVouchersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await authorize('voucher_recieve.index');
  const sp = await searchParams;
  const requestedPage = Number(sp.page);
  const [{ rows, total, page, perPage }, canCreate, canEdit, canDelete, canView] = await Promise.all([
    listVouchers({ paymentType: 'voucher_recieve', page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1 }),
    can('voucher_recieve.store'), can('voucher_recieve.edit'), can('vouchers.destroy'), can('vouchers.show'),
  ]);
  const decorated = await Promise.all(rows.map(async (voucher) => ({
    ...voucher, dateLabel: await dateConvert(voucher.date), amountLabel: await singlePrice(voucher.amount),
  })));
  // Amounts are formatted through the configured currency settings, so the
  // page total goes through the same async formatter the rows do.
  const approvedCount = decorated.filter((voucher) => voucher.isApprove === 1).length;
  const cancelledCount = decorated.filter((voucher) => voucher.isApprove === 2).length;
  const pendingCount = decorated.length - approvedCount - cancelledCount;
  const pageValueLabel = await singlePrice(decorated.reduce((sum, voucher) => sum + Number(voucher.amount ?? 0), 0));

  return <>
    <PageHeader title="Receipt Vouchers" breadcrumb={[{ label: 'Accounts'}, { label:'Receipt Vouchers' }]}
      actions={canCreate ? <LinkButton href={ROUTES['voucher_recieve.create']} >Add Receipt</LinkButton> : null} />
    <ReportSummary
      figures={[
        { label: 'Pending approval', value: pendingCount, detail: 'On this page', icon: Hourglass },
        { label: 'Approved', value: approvedCount, detail: 'On this page', icon: CircleCheck },
        { label: 'Cancelled', value: cancelledCount, detail: 'On this page', icon: CircleX },
        { label: 'Value on this page', value: pageValueLabel, detail: `${decorated.length} of ${total} receipts`, icon: Wallet },
        { label: 'Receipts', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Files },
      ]}
    />
    <Card title={`Receipts (${total})`} bodyClassName="">
      <DataTable columns={[{ label: 'Voucher' }, { label: 'Date' }, { label: 'Type' }, { label: 'Accounts'}, { label:'Amount'}, { label:'Approval'}, { label:'Actions' }]} isEmpty={!rows.length} empty="No receipt vouchers found.">
        {decorated.map((voucher) => <Tr key={voucher.id}>
          <Td>{canView ? <Link className="text-primary" href={route('vouchers.show', { id: voucher.id })}>{voucher.txId ?? voucher.id}</Link> : voucher.txId ?? voucher.id}</Td>
          <Td>{voucher.dateLabel}</Td><Td>{voucher.voucherType}</Td>
          <Td>{voucher.legs.map((leg, index) => <span className="block text-xs" key={index}>{leg.type}: {leg.accountName}</span>)}</Td>
          <Td>{voucher.amountLabel}</Td>
          <Td><Badge size="sm" color={voucher.isApprove === 1 ? 'success' : voucher.isApprove === 2 ? 'error' : 'warning'}>{voucher.isApprove === 1 ?'Approved': voucher.isApprove === 2 ?'Cancelled':'Pending'}</Badge></Td>
          <Td><div className="flex items-center gap-3">
            {canEdit ? <Link className="text-primary" href={route('voucher_recieve.edit', { id: voucher.id })}><Phrase>Edit</Phrase></Link> : null}
            {canDelete ? <form action={deleteVoucherAction}><input type="hidden" name="id" value={voucher.id} /><ActionButton confirm="Delete this receipt and its postings?"><Phrase>Delete</Phrase></ActionButton></form> : null}
          </div></Td>
        </Tr>)}
      </DataTable>
      <Pagination page={page} perPage={perPage} total={total} baseUrl={ROUTES['voucher_recieve.index']} params={sp} />
    </Card>
  </>;
}
