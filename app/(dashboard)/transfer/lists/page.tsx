import { LinkButton } from '@/components/common/link-button';
// Money transfer list - port of TransferController@index
// (`account::transfers.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { transferVouchers } from '@/lib/accounting/transfers';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';
import { ReportSummary } from '@/components/erp/report-summary';
import { ArrowLeftRight, CircleCheck, Clock, Wallet } from 'lucide-react';

export const metadata: Metadata = { title: 'Money Transfer' };

export default async function TransferListPage() {
  await authorize('transfer_showroom.index');

  const vouchers = await transferVouchers();
  const canEdit = await can('transfer_showroom.edit');

  const rows = await Promise.all(
    vouchers.map(async (voucher) => ({
      voucher,
      dateLabel: await dateConvert(voucher.date),
      amountLabel: await singlePrice(voucher.amount),
    })),
  );

  const approvedCount = vouchers.filter((voucher) => voucher.isApprove === 1).length;
  const totalLabel = await singlePrice(
    vouchers.reduce((sum, voucher) => sum + Number(voucher.amount ?? 0), 0),
  );

  return (
    <>
      <PageHeader
        title="Money Transfer"
        breadcrumb={[{ label: 'Accounts'}, { label:'Money Transfer' }]}
        actions={
          <LinkButton
            href={ROUTES['transfer_showroom.create']}
            
          >
            Transfer Money
          </LinkButton>
        }
      />

      <ReportSummary
        figures={[
          { label: 'Transfers', value: rows.length, detail: 'Between branches', icon: ArrowLeftRight },
          { label: 'Approved', value: approvedCount, detail: 'Posted to the ledger', icon: CircleCheck },
          {
            label: 'Pending',
            value: rows.length - approvedCount,
            detail: 'Awaiting approval',
            icon: Clock,
          },
          { label: 'Total moved', value: totalLabel, detail: 'Across every transfer', icon: Wallet },
        ]}
      />

      <Card title="All transfers" bodyClassName="">
        <DataTable
          columns={[
            { label: 'TX ID' },
            { label: 'Date' },
            { label: 'Narration' },
            { label: 'Amount' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={rows.length === 0}
          empty="No transfers yet."
        >
          {rows.map((row) => (
            <Tr key={row.voucher.id}>
              <Td className="font-medium text-foreground">
                {row.voucher.txId ?? row.voucher.id}
              </Td>
              <Td>{row.dateLabel}</Td>
              <Td>{row.voucher.narration ?? '-'}</Td>
              <Td>{row.amountLabel}</Td>
              <Td>
                <Badge color={row.voucher.isApprove === 1 ? 'success' : 'warning'} size="sm">
                  {row.voucher.isApprove === 1 ? 'Approved':'Pending'}
                </Badge>
              </Td>
              <Td>
                {canEdit ? (
                  <Link
                    href={route('transfer_showroom.edit', { id: row.voucher.id })}
                    className="text-xs font-medium text-primary hover:text-primary"
                  >
                    Edit
                  </Link>
                ) : null}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
