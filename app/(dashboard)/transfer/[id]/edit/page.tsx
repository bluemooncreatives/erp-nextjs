// Edit a money transfer - port of TransferController@edit
// (`account::transfers.transfer_to_showroom_edit`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findTransferVoucher, showroomAccounts } from '@/lib/accounting/transfers';
import { paymentAccounts } from '@/lib/accounting/accounts';
import { generalSetting } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { VoucherForm } from '../../../account/voucher-form';
import { saveTransfer } from '../../actions';

export const metadata: Metadata = { title: 'Edit Transfer' };

export default async function TransferEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('transfer_showroom.edit');
  const { id } = await params;

  const [record, setting, sources, destinations] = await Promise.all([
    findTransferVoucher(Number(id)),
    generalSetting(),
    paymentAccounts(),
    showroomAccounts(),
  ]);

  if (!record) notFound();

  const label = (a: { id: number; name: string | null; code: string | null }) => ({
    value: a.id,
    label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
  });

  // The main leg is the one posted against the payment account; the rest are
  // the destinations the form edits as lines.
  const sourceIds = new Set(sources.map((a) => a.id));
  const mainLeg = record.legs.find((leg) => sourceIds.has(leg.accountId)) ?? null;
  const lines = record.legs
    .filter((leg) => leg.id !== mainLeg?.id)
    .map((leg) => ({
      accountId: leg.accountId,
      amount: leg.amount,
      narration: leg.narration,
    }));

  return (
    <>
      <PageHeader
        title="Edit Transfer"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Money Transfer' }]}
      />
      <VoucherForm
        action={saveTransfer}
        heading="Transfer Details"
        mainAccountLabel="Payment From Account"
        mainAccounts={sources.map(label)}
        lineAccountLabel="Payment To"
        lineAccounts={destinations.map(label)}
        currencySymbol={setting.currencySymbol ?? '$'}
        cancelHref={ROUTES['transfer_showroom.index']}
        submitLabel="Update Transfer"
        defaults={{
          id: record.voucher.id,
          accountId: mainLeg?.accountId ?? null,
          date: record.voucher.date,
          narration: record.voucher.narration,
          lines,
        }}
      />
    </>
  );
}
