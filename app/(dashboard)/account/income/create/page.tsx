// Add income - port of IncomeController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { incomeAccountList } from '@/lib/accounting/expenses';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { VoucherForm } from '../../voucher-form';
import { storeIncome } from '../../actions';

export const metadata: Metadata = { title: 'Add Income' };

export default async function CreateIncomePage() {
  await authorize('income.store');
  const setting = await generalSetting();

  const [payAccounts, incomeAccountRows] = await Promise.all([
    paymentAccountOptions(),
    incomeAccountList(),
  ]);

  return (
    <>
      <PageHeader
        title="Add Income"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Add Income' }]}
      />
      <VoucherForm
        action={storeIncome}
        heading="Income Details"
        mainAccountLabel="Received into (cash / bank)"
        mainAccounts={payAccounts.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
        lineAccountLabel="Income account"
        lineAccounts={incomeAccountRows.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
        currencySymbol={setting.currencySymbol ?? '$'}
        cancelHref={ROUTES['income.index']}
        submitLabel="Save Income"
      />
    </>
  );
}
