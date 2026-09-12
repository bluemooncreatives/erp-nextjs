// Accounting periods / opening balances - port of
// OpeningBalanceHistoryController@index (`account::opening_balances.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { accountingPeriods } from '@/lib/accounting/opening-balance';
import { dateConvert } from '@/lib/settings';
import { ROUTES, route } from '@/lib/routes';
import { today } from '@/lib/php-date';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { closeStatement } from './actions';

export const metadata: Metadata = { title: 'Opening Balance' };

export default async function OpeningBalanceIndexPage() {
  await authorize('openning_balance.index');

  const periods = await accountingPeriods();
  const [canEdit, canClose] = await Promise.all([
    can('openning_balance.edit'),
    can('openning_balance.closeStatement'),
  ]);

  const rows = await Promise.all(
    periods.map(async (period) => ({
      period,
      startLabel: await dateConvert(period.startDate),
      endLabel: period.endDate ? await dateConvert(period.endDate) : '-',
    })),
  );

  return (
    <>
      <PageHeader
        title="Opening Balance"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Opening Balance' }]}
        actions={
          <Link
            href={ROUTES['openning_balance.create']}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
          >
            Add Opening Balance
          </Link>
        }
      />

      <Card title={`Accounting periods (${rows.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'Start Date' },
            { label: 'End Date' },
            { label: 'Status' },
            { label: 'Action' },
          ]}
          isEmpty={rows.length === 0}
          empty="No accounting periods."
        >
          {rows.map((row, index) => (
            <Tr key={row.period.id}>
              <Td>{index + 1}</Td>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {row.startLabel}
              </Td>
              <Td>{row.endLabel}</Td>
              <Td>
                <Badge color={row.period.isClosed === 1 ? 'error' : 'success'} size="sm">
                  {row.period.isClosed === 1 ? 'Closed' : 'Open'}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-3">
                  {canEdit ? (
                    <Link
                      href={route('openning_balance.edit', { id: row.period.id })}
                      className="text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canClose && row.period.isClosed !== 1 ? (
                    <form action={closeStatement} className="flex items-center gap-2">
                      <input type="hidden" name="timeInterval_id" value={row.period.id} />
                      <input
                        type="date"
                        name="date"
                        defaultValue={today()}
                        className="h-8 rounded-lg border border-gray-300 bg-transparent px-2 text-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                      <ActionButton
                        variant="primary"
                        confirm="Close this accounting period? Balances will be carried forward."
                      >
                        Close period
                      </ActionButton>
                    </form>
                  ) : null}
                </div>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
