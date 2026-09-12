// Add contra voucher - port of ContraVoucherController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { PageHeader } from '@/components/erp/page';
import { ContraVoucherForm } from './contra-form';

export const metadata: Metadata = { title: 'Add Contra Voucher' };

export default async function CreateContraVoucherPage() {
  await authorize('contra.store');
  const accounts = await paymentAccountOptions();

  return (
    <>
      <PageHeader
        title="Add Contra Voucher"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Contra Voucher' }]}
      />
      <ContraVoucherForm
        accounts={accounts.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
      />
    </>
  );
}
