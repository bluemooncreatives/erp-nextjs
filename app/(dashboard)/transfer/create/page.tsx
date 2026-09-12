// Transfer money to a showroom - port of TransferController@showroom_create
// (`account::transfers.transfer_to_showroom`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { showroomAccounts } from '@/lib/accounting/transfers';
import { paymentAccounts } from '@/lib/accounting/accounts';
import { generalSetting } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { VoucherForm } from '../../account/voucher-form';
import { storeTransfer } from '../actions';

export const metadata: Metadata = { title: 'Transfer Money' };

export default async function TransferCreatePage() {
  await authorize('transfer_showroom.create');

  const [setting, sources, destinations] = await Promise.all([
    generalSetting(),
    paymentAccounts(),
    showroomAccounts(),
  ]);

  const label = (a: { id: number; name: string | null; code: string | null }) => ({
    value: a.id,
    label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
  });

  return (
    <>
      <PageHeader
        title="Transfer Money"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Money Transfer' }]}
      />
      <VoucherForm
        action={storeTransfer}
        heading="Transfer Details"
        mainAccountLabel="Payment From Account"
        mainAccounts={sources.map(label)}
        lineAccountLabel="Payment To"
        lineAccounts={destinations.map(label)}
        currencySymbol={setting.currencySymbol ?? '$'}
        cancelHref={ROUTES['transfer_showroom.index']}
        submitLabel="Transfer"
      />
    </>
  );
}
