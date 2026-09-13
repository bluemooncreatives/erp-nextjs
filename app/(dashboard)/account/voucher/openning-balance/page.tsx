import { LinkButton } from '@/components/common/link-button';
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
import { ReportSummary } from '@/components/erp/report-summary';
import { CalendarRange, DoorClosed, DoorOpen } from 'lucide-react';
import { closeStatement } from './actions';
import { Phrase } from '@/context/TranslationContext';

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

  const closedCount = periods.filter((period) => period.isClosed === 1).length;

  return (
    <>
      <PageHeader
        title="Opening Balance"
        breadcrumb={[{ label: 'Accounts'}, { label:'Opening Balance' }]}
        actions={
          <LinkButton
            href={ROUTES['openning_balance.create']}
            
          >
            Add Opening Balance
          </LinkButton>
        }
      />

      <ReportSummary
        figures={[
          { label: 'Periods', value: rows.length, detail: 'Recorded in total', icon: CalendarRange },
          {
            label: 'Open',
            value: rows.length - closedCount,
            detail: 'Still accepting postings',
            icon: DoorOpen,
          },
          { label: 'Closed', value: closedCount, detail: 'Balances carried forward', icon: DoorClosed },
        ]}
      />

      <Card title="Accounting periods" bodyClassName="">
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
              <Td className="font-medium text-foreground">
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
                      className="text-xs font-medium text-primary hover:text-primary"
                    >
                      <Phrase>Edit</Phrase>
                    </Link>
                  ) : null}
                  {canClose && row.period.isClosed !== 1 ? (
                    <form action={closeStatement} className="flex items-center gap-2">
                      <input type="hidden" name="timeInterval_id" value={row.period.id} />
                      <input
                        type="date"
                        name="date"
                        defaultValue={today()}
                        aria-label="Closing date"
                        className="border-input bg-input-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px]"
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
