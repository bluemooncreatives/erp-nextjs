// Balance statement - port of BalanceStatementController@index
// (`report::balance_sheet_statements.index`), which listed the balances the
// close of a period carried into the next one.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { balanceStatement, reportPeriods } from '@/lib/reports/statements';
import { AccountType } from '@/lib/accounting/accounts';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Landmark, Scale, CircleAlert, Wallet } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { PeriodFilter } from '../period-filter';

export const metadata: Metadata = { title: 'Balance Statement' };

export default async function BalanceStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  await authorize('balance_statement_report.index');
  const sp = await searchParams;

  const periods = await reportPeriods();
  const intervalId = Number(sp.interval) || periods[0]?.id;
  const rows = intervalId ? await balanceStatement(intervalId) : [];

  const periodOptions = await Promise.all(
    periods.map(async (period) => ({
      value: period.id,
      label: `${await dateConvert(period.startDate)} - ${
        period.endDate ? await dateConvert(period.endDate) : 'open'
      }`,
    })),
  );

  const assets = rows.filter((r) => Number(r.accountType) === AccountType.Asset);
  const liabilities = rows.filter((r) => Number(r.accountType) === AccountType.Liability);

  const decorate = async (list: typeof rows) =>
    Promise.all(
      list.map(async (row) => ({
        ...row,
        amountLabel: await singlePrice(row.history.amount),
      })),
    );

  const [assetRows, liabilityRows] = await Promise.all([
    decorate(assets),
    decorate(liabilities),
  ]);

  // A balance statement is read for whether the two sides agree, so the
  // difference gets a tile of its own rather than being left to the reader.
  const assetSum = assets.reduce((sum, r) => sum + r.history.amount, 0);
  const liabilitySum = liabilities.reduce((sum, r) => sum + r.history.amount, 0);
  const [assetTotal, liabilityTotal, differenceLabel] = await Promise.all([
    singlePrice(assetSum),
    singlePrice(liabilitySum),
    singlePrice(Math.abs(assetSum - liabilitySum)),
  ]);

  return (
    <>
      <PageHeader
        title="Balance Statement"
        breadcrumb={[{ label: 'Reports' }, { label: 'Balance Statement' }]}
        actions={
          <PeriodFilter
            action={ROUTES['balance_statement_report.index']}
            options={periodOptions}
            value={intervalId ? String(intervalId) : ''}
          />
        }
      />

      {rows.length === 0 ? (
        <Card title="Balance Statement">
          <EmptyState message="No data Found - close an accounting period to build one." />
        </Card>
      ) : (
        <div className="space-y-5">
          <ReportSummary
            figures={[
              { label: 'Total assets', value: assetTotal, detail: `${assets.length} accounts`, icon: Landmark },
              { label: 'Liabilities & equity', value: liabilityTotal, detail: `${liabilities.length} accounts`, icon: Wallet },
              { label: 'Difference', value: differenceLabel, detail: assetSum === liabilitySum ? 'The statement balances' : 'The two sides do not agree', icon: assetSum === liabilitySum ? Scale : CircleAlert },
            ]}
            className="mb-0"
          />

          <div className="grid gap-5 lg:grid-cols-2">
          <Card title={`Assets - ${assetTotal}`} bodyClassName="">
            <DataTable
              columns={[{ label: 'Account' }, { label: 'Amount' }]}
              isEmpty={assetRows.length === 0}
              empty="No assets carried forward."
            >
              {assetRows.map((row) => (
                <Tr key={row.history.id}>
                  <Td>{`${row.accountName ?? '-'}${row.accountCode ? ` (${row.accountCode})` : ''}`}</Td>
                  <Td className="text-right">{row.amountLabel}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>

          <Card title={`Liabilities & Equity - ${liabilityTotal}`} bodyClassName="">
            <DataTable
              columns={[{ label: 'Account' }, { label: 'Amount' }]}
              isEmpty={liabilityRows.length === 0}
              empty="No liabilities carried forward."
            >
              {liabilityRows.map((row) => (
                <Tr key={row.history.id}>
                  <Td>{`${row.accountName ?? '-'}${row.accountCode ? ` (${row.accountCode})` : ''}`}</Td>
                  <Td className="text-right">{row.amountLabel}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
          </div>
        </div>
      )}
    </>
  );
}
