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
import { deleteVoucherAction } from '../../actions';

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
  return <>
    <PageHeader title="Receipt Vouchers" breadcrumb={[{ label: 'Accounts'}, { label:'Receipt Vouchers' }]}
      actions={canCreate ? <Link href={ROUTES['voucher_recieve.create']} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white">Add Receipt</Link> : null} />
    <Card title={`Receipts (${total})`} bodyClassName="">
      <DataTable columns={[{ label: 'Voucher' }, { label: 'Date' }, { label: 'Type' }, { label: 'Accounts'}, { label:'Amount'}, { label:'Approval'}, { label:'Actions' }]} isEmpty={!rows.length} empty="No receipt vouchers found.">
        {decorated.map((voucher) => <Tr key={voucher.id}>
          <Td>{canView ? <Link className="text-primary" href={route('vouchers.show', { id: voucher.id })}>{voucher.txId ?? voucher.id}</Link> : voucher.txId ?? voucher.id}</Td>
          <Td>{voucher.dateLabel}</Td><Td>{voucher.voucherType}</Td>
          <Td>{voucher.legs.map((leg, index) => <span className="block text-xs" key={index}>{leg.type}: {leg.accountName}</span>)}</Td>
          <Td>{voucher.amountLabel}</Td>
          <Td><Badge size="sm" color={voucher.isApprove === 1 ? 'success' : voucher.isApprove === 2 ? 'error' : 'warning'}>{voucher.isApprove === 1 ?'Approved': voucher.isApprove === 2 ?'Cancelled':'Pending'}</Badge></Td>
          <Td><div className="flex items-center gap-3">
            {canEdit ? <Link className="text-primary" href={route('voucher_recieve.edit', { id: voucher.id })}>Edit</Link> : null}
            {canDelete ? <form action={deleteVoucherAction}><input type="hidden" name="id" value={voucher.id} /><ActionButton confirm="Delete this receipt and its postings?">Delete</ActionButton></form> : null}
          </div></Td>
        </Tr>)}
      </DataTable>
      <Pagination page={page} perPage={perPage} total={total} baseUrl={ROUTES['voucher_recieve.index']} params={sp} />
    </Card>
  </>;
}
