// Edit a period's opening balances - port of
// OpeningBalanceHistoryController@edit (`account::opening_balances.edit`).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import {
  assetAccounts,
  liabilityAccounts,
  openingBalancesForPeriod,
  accountingPeriods,
  AccTypeAsset,
} from '@/lib/accounting/opening-balance';
import { today } from '@/lib/php-date';
import { PageHeader, Card } from '@/components/erp/page';
import { EditOpeningBalancesForm } from '../../forms';

export const metadata: Metadata = { title: 'Edit Opening Balance' };

export default async function OpeningBalanceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await authorize('openning_balance.edit');
  const { id } = await params;
  const periodId = Number(id);

  const [periods, assets, liabilities, balances] = await Promise.all([
    accountingPeriods(),
    assetAccounts(),
    liabilityAccounts(),
    openingBalancesForPeriod(periodId),
  ]);

  const period = periods.find((p) => p.id === periodId);
  if (!period) notFound();

  const label = (a: { id: number; name: string; code: string | null }) => ({
    value: a.id,
    label: `${a.name}${a.code ? ` (${a.code})` : ''}`,
  });

  const lines = (accType: string) =>
    balances
      .filter((b) => b.history.accType === accType)
      .map((b) => ({ accountId: b.history.accountId ?? 0, amount: b.history.amount }));

  return (
    <>
      <PageHeader
        title="Edit Opening Balance"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Opening Balance' }]}
      />
      <Card title={`Period from ${period.startDate ?? '-'}`}>
        <EditOpeningBalancesForm
          periodId={periodId}
          date={period.startDate ?? today()}
          assetAccounts={assets.map(label)}
          liabilityAccounts={liabilities.map(label)}
          assetLines={lines(AccTypeAsset)}
          liabilityLines={lines('liability')}
        />
      </Card>
    </>
  );
}
