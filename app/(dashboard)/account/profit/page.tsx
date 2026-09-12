// Profit & Loss - port of GeneralLedgerController@profit.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { profitAndLoss } from '@/lib/accounting/reports';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
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
        breadcrumb={[{ label: 'Accounts'}, { label:'Profit & Loss' }]}
        actions={
          <DateRangeFilter action={ROUTES['profit.index']} from={sp.from} to={sp.to} />
        }
      />

      {/* These three were a local `Figure` tile that existed only on this page.
          They are the same shape as every other summary, so they use it. */}
      <ReportSummary
        figures={[
          { label: 'Total income', value: money(pnl.totalIncome), detail: periodLabel, icon: ArrowDownLeft },
          { label: 'Total expense', value: money(pnl.totalExpense), detail: periodLabel, icon: ArrowUpRight },
          {
            label: pnl.netProfit >= 0 ? 'Net profit' : 'Net loss',
            value: money(Math.abs(pnl.netProfit)),
            detail: 'Income less expense',
            icon: pnl.netProfit >= 0 ? TrendingUp : TrendingDown,
          },
        ]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">

        <div className="col-span-12 lg:col-span-6">
          <Card title="Income" bodyClassName="">
            <DataTable
              columns={[{ label: 'Account'}, { label:'Code'}, { label:'Amount' }]}
              isEmpty={pnl.income.length === 0}
              empty="No income in this period."
            >
              {pnl.income.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-foreground">
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
              columns={[{ label: 'Account'}, { label:'Code'}, { label:'Amount' }]}
              isEmpty={pnl.expense.length === 0}
              empty="No expenses in this period."
            >
              {pnl.expense.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-foreground">
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

