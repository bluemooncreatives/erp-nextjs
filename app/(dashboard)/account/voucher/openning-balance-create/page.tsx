// Add opening balance - port of OpeningBalanceHistoryController@create
// (`account::opening_balances.create`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { postableAccounts } from '@/lib/accounting/reports';
import { PageHeader, Card } from '@/components/erp/page';
import { OpeningBalanceForm } from '../openning-balance/forms';

export const metadata: Metadata = { title: 'Add Opening Balance' };

export default async function OpeningBalanceCreatePage() {
  await authorize('openning_balance.create');
  const accounts = await postableAccounts();

  return (
    <>
      <PageHeader
        title="Add Opening Balance"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Opening Balance' }]}
      />
      <Card title="Opening Balance">
        <OpeningBalanceForm
          accounts={accounts.map((a) => ({
            value: a.id,
            label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
          }))}
        />
      </Card>
    </>
  );
}
