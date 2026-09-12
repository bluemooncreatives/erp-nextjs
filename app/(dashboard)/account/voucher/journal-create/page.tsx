// Add journal voucher - port of JournalController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { postableAccounts } from '@/lib/accounting/reports';
import { generalSetting } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { VoucherForm } from '../../voucher-form';
import { storeJournalVoucher } from '../../actions';

export const metadata: Metadata = { title: 'Add Journal Voucher' };

export default async function CreateJournalPage() {
  await authorize('journal.store');
  const setting = await generalSetting();
  const accounts = await postableAccounts();

  const options = accounts.map((a) => ({
    value: a.id,
    label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
  }));

  return (
    <>
      <PageHeader
        title="Add Journal Voucher"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Journal' }]}
      />
      <VoucherForm
        action={storeJournalVoucher}
        heading="Journal Details"
        mainAccountLabel="Main account"
        mainAccounts={options}
        lineAccountLabel="Contra account"
        lineAccounts={options}
        currencySymbol={setting.currencySymbol ?? '$'}
        cancelHref={ROUTES['journal.index']}
        submitLabel="Save Journal"
        showPaymentMethod={false}
        showAccountTypeToggle
      />
    </>
  );
}
