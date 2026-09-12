// Add contra voucher - port of ContraVoucherController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { activeAccounts } from '@/lib/accounting/journal';
import { generalSetting } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { ContraVoucherForm } from './contra-form';

export const metadata: Metadata = { title: 'Add Contra Voucher' };

export default async function CreateContraVoucherPage() {
  await authorize('contra.store');
  const [accounts, settings] = await Promise.all([activeAccounts(), generalSetting()]);

  return (
    <>
      <PageHeader
        title="Add Contra Voucher"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Contra Voucher' }]}
      />
      <ContraVoucherForm
        currencySymbol={settings.currencySymbol ?? '$'}
        accounts={accounts.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
      />
    </>
  );
}
