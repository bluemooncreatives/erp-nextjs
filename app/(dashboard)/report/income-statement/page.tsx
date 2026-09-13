// Income statement - port of IncomeStateMentController@index
// (`report::income_statements.index`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { incomeStatement, reportPeriods } from '@/lib/reports/statements';
import { openAccountingPeriod } from '@/lib/accounting/periods';
import { dateConvert, singlePrice } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { TrendingUp, Coins, Receipt, Scale } from 'lucide-react';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { PeriodFilter } from '../period-filter';
import { Phrase } from '@/context/TranslationContext';

export const metadata: Metadata = { title: 'Income Statement' };

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  await authorize('income_statement_report.index');
  const sp = await searchParams;

  const periods = await reportPeriods();
  const open = await openAccountingPeriod();
  const intervalId = Number(sp.interval) || open?.id || periods[0]?.id;

  const statement = intervalId ? await incomeStatement(intervalId) : null;

  const periodOptions = await Promise.all(
    periods.map(async (period) => ({
      value: period.id,
      label: `${await dateConvert(period.startDate)} - ${
        period.endDate ? await dateConvert(period.endDate) : 'open'
      }`,
    })),
  );

  const money = (value: number) => singlePrice(value);

  const incomeRows = statement
    ? await Promise.all(
        statement.income.map(async (a) => ({ ...a, label: await money(a.balance) })),
      )
    : [];
  const expenseRows = statement
    ? await Promise.all(
        statement.expense.map(async (a) => ({ ...a, label: await money(a.balance) })),
      )
    : [];

  const [salesLabel, cogsLabel, grossLabel, incomeTotal, expenseTotal, netLabel] =
    statement
      ? await Promise.all([
          money(statement.sales),
          money(statement.costOfGoods),
          money(statement.grossProfit),
          money(statement.totalIncome),
          money(statement.totalExpense),
          money(statement.netProfit),
        ])
      : ['', '', '', '', '', ''];

  return (
    <>
      <PageHeader
        title="Income Statement"
        breadcrumb={[{ label: 'Reports' }, { label: 'Income Statement' }]}
        actions={
          <PeriodFilter
            action={ROUTES['income_statement_report.index']}
            options={periodOptions}
            value={intervalId ? String(intervalId) : ''}
          />
        }
      />

      {!statement ? (
        <Card title="Income Statement">
          <EmptyState message="No data Found" />
        </Card>
      ) : (
        <div className="space-y-5">
          {/* The four figures the statement exists to produce, before the
              account-by-account breakdown that explains them. */}
          <ReportSummary
            figures={[
              { label: 'Sales', value: salesLabel, detail: 'Over the selected period', icon: Coins },
              { label: 'Gross profit', value: grossLabel, detail: `After ${cogsLabel} cost of goods`, icon: TrendingUp },
              { label: 'Expenses', value: expenseTotal, detail: `Against ${incomeTotal} other income`, icon: Receipt },
              { label: 'Net profit', value: netLabel, detail: 'Gross profit less expenses plus other income', icon: Scale },
            ]}
            className="mb-0"
          />

          <Card title="Gross Profit" bodyClassName="">
            <DataTable columns={[{ label: '' }, { label: 'Amount' }]} isEmpty={false}>
              <Tr>
                <Td><Phrase>Sales</Phrase></Td>
                <Td className="text-end">{salesLabel}</Td>
              </Tr>
              <Tr>
                <Td>Cost of Goods Sold</Td>
                <Td className="text-end">{cogsLabel}</Td>
              </Tr>
              <Tr>
                <Td className="font-medium text-foreground">Gross Profit</Td>
                <Td className="text-end font-medium text-foreground">
                  {grossLabel}
                </Td>
              </Tr>
            </DataTable>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={`Other Income - ${incomeTotal}`} bodyClassName="">
              <DataTable
                columns={[{ label: 'Account'}, { label:'Amount' }]}
                isEmpty={incomeRows.length === 0}
                empty="No income accounts moved in this period."
              >
                {incomeRows.map((row) => (
                  <Tr key={row.id}>
                    <Td>{`${row.name}${row.code ? ` (${row.code})` : ''}`}</Td>
                    <Td className="text-end">{row.label}</Td>
                  </Tr>
                ))}
              </DataTable>
            </Card>

            <Card title={`Expenses - ${expenseTotal}`} bodyClassName="">
              <DataTable
                columns={[{ label: 'Account'}, { label:'Amount' }]}
                isEmpty={expenseRows.length === 0}
                empty="No expense accounts moved in this period."
              >
                {expenseRows.map((row) => (
                  <Tr key={row.id}>
                    <Td>{`${row.name}${row.code ? ` (${row.code})` : ''}`}</Td>
                    <Td className="text-end">{row.label}</Td>
                  </Tr>
                ))}
              </DataTable>
            </Card>
          </div>

          <Card title="Net Profit">
            <p className="text-2xl font-semibold text-foreground">
              {netLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Gross profit less expenses plus other income.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
