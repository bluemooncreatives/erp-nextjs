// Profit & Loss - port of GeneralLedgerController@profit.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { profitAndLoss } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { DateRangeFilter } from '../date-range-filter';

export const metadata: Metadata = { title: 'Profit & Loss' };

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await authorize('profit.index');
  const sp = await searchParams;
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const pnl = await profitAndLoss({ from: sp.from, to: sp.to });
  const money = (v: number) => `${symbol} ${numberFormat(v)}`;

  const periodLabel =
    pnl.from && pnl.to
      ? `${await dateConvert(pnl.from)} - ${await dateConvert(pnl.to)}`
      : 'All time';

  return (
    <>
      <PageHeader
        title="Profit & Loss"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Profit & Loss' }]}
        actions={
          <DateRangeFilter action={ROUTES['profit.index']} from={sp.from} to={sp.to} />
        }
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <Card title="Result" desc={periodLabel}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Figure label="Total Income" value={money(pnl.totalIncome)} />
              <Figure label="Total Expense" value={money(pnl.totalExpense)} />
              <Figure
                label={pnl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                value={money(Math.abs(pnl.netProfit))}
                tone={pnl.netProfit >= 0 ? 'success' : 'error'}
              />
            </dl>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card title="Income" bodyClassName="">
            <DataTable
              columns={[{ label: 'Account' }, { label: 'Code' }, { label: 'Amount' }]}
              isEmpty={pnl.income.length === 0}
              empty="No income in this period."
            >
              {pnl.income.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {row.name}
                  </Td>
                  <Td>{row.code ?? '-'}</Td>
                  <Td>{money(row.balance)}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card title="Expense" bodyClassName="">
            <DataTable
              columns={[{ label: 'Account' }, { label: 'Code' }, { label: 'Amount' }]}
              isEmpty={pnl.expense.length === 0}
              empty="No expenses in this period."
            >
              {pnl.expense.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {row.name}
                  </Td>
                  <Td>{row.code ?? '-'}</Td>
                  <Td>{money(row.balance)}</Td>
                </Tr>
              ))}
            </DataTable>
          </Card>
        </div>
      </div>
    </>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'error';
}) {
  const colour =
    tone === 'success'
      ? 'text-success-600 dark:text-success-400'
      : tone === 'error'
        ? 'text-error-500'
        : 'text-gray-800 dark:text-white/90';

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-1 text-title-sm font-bold ${colour}`}>{value}</dd>
    </div>
  );
}
