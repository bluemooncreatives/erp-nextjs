// Add payment voucher - port of VoucherController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { postableAccounts } from '@/lib/accounting/reports';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { PageHeader } from '@/components/erp/page';
import { PaymentVoucherForm } from './payment-voucher-form';

export const metadata: Metadata = { title: 'Add Payment Voucher' };

export default async function CreateVoucherPage() {
  await authorize('vouchers.store');
  const setting = await generalSetting();

  const [payAccounts, accounts] = await Promise.all([
    paymentAccountOptions(),
    postableAccounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Add Payment Voucher"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Payment Voucher' }]}
      />
      <PaymentVoucherForm
        heading="Voucher Details"
        paymentType="voucher_payment"
        currencySymbol={setting.currencySymbol ?? '$'}
        payAccounts={payAccounts.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
        allAccounts={accounts.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
      />
    </>
  );
}
