// Add expense - port of ExpenseController@create.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { expenseAccounts } from '@/lib/accounting/expenses';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { VoucherForm } from '../../voucher-form';
import { storeExpense } from '../../actions';

export const metadata: Metadata = { title: 'Add Expense' };

export default async function CreateExpensePage() {
  await authorize('expenses.store');
  const setting = await generalSetting();

  const [payAccounts, expenseAccountRows] = await Promise.all([
    paymentAccountOptions(),
    expenseAccounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Add Expense"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Add Expense' }]}
      />
      <VoucherForm
        action={storeExpense}
        heading="Expense Details"
        mainAccountLabel="Paid from (cash / bank)"
        mainAccounts={payAccounts.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
        lineAccountLabel="Expense account"
        lineAccounts={expenseAccountRows.map((a) => ({
          value: a.id,
          label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
        }))}
        currencySymbol={setting.currencySymbol ?? '$'}
        cancelHref={ROUTES['expenses.index']}
        submitLabel="Save Expense"
      />
    </>
  );
}
