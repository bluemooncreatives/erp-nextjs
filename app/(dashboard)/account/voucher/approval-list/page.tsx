// Voucher approval list - port of VoucherController@approval_index.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listVouchers } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { morphName } from '@/lib/db/morph';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton, SubmitButton } from '@/components/erp/submit-button';
import { approveAllVouchersAction, setVoucherApprovalAction } from '../../actions';

export const metadata: Metadata = { title: 'Voucher Approval' };

export default async function VoucherApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await authorize('voucher_approval.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listVouchers({
    isApprove: 0,
    page: Number(sp.page ?? 1),
  });

  const [canApprove, canApproveAll] = await Promise.all([
    can('set_voucher_approval'),
    can('voucher.all.approval'),
  ]);

  const voucherRows = await Promise.all(
    rows.map(async (v) => ({ ...v, dateLabel: await dateConvert(v.date) })),
  );

  return (
    <>
      <PageHeader
        title="Voucher Approval"
        breadcrumb={[{ label: 'Accounts'}, { label:'Voucher Approval' }]}
        actions={
          canApproveAll && total > 0 ? (
            <form action={approveAllVouchersAction}>
              <SubmitButton pendingLabel="Approving...">Approve all</SubmitButton>
            </form>
          ) : null
        }
      />

      <Card title={`Pending vouchers (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Voucher' },
            { label: 'Date' },
            { label: 'Type' },
            { label: 'Postings' },
            { label: 'Source' },
            { label: 'Amount' },
            { label: 'Action' },
          ]}
          isEmpty={voucherRows.length === 0}
          empty="Nothing awaiting approval."
        >
          {voucherRows.map((voucher) => (
            <Tr key={voucher.id}>
              <Td className="font-medium text-foreground">
                {voucher.txId ?? voucher.id}
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
              <Td>
                {voucher.referableType
                  ? `${morphName(voucher.referableType) ?? ''} #${voucher.referableId}`
                  : '-'}
              </Td>
              <Td>{`${symbol} ${numberFormat(voucher.amount)}`}</Td>
              <Td>
                {canApprove ? (
                  <div className="flex items-center gap-2">
                    <form action={setVoucherApprovalAction}>
                      <input type="hidden" name="id" value={voucher.id} />
                      <input type="hidden" name="status" value="1" />
                      <ActionButton variant="primary">Approve</ActionButton>
                    </form>
                    <form action={setVoucherApprovalAction}>
                      <input type="hidden" name="id" value={voucher.id} />
                      <input type="hidden" name="status" value="2" />
                      <ActionButton confirm="Cancel this voucher?">Cancel</ActionButton>
                    </form>
                  </div>
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
          baseUrl={ROUTES['voucher_approval.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
