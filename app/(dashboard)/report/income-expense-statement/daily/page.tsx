// Daily income & expense - port of IncomeStateMentController@dailyReport and
// @dailyReportSearch (`report::income_statements.daily_report`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { dailyStatement } from '@/lib/reports/statements';
import { dateConvert, singlePrice } from '@/lib/settings';
import { toDateString, today } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { SingleDateFilter } from '../../period-filter';

export const metadata: Metadata = { title: 'Daily Income & Expense' };

export default async function DailyIncomeExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await authorize('income_statement_report.daily');
  const sp = await searchParams;

  const date = toDateString(sp.date) ?? today();
  const { income, expense } = await dailyStatement(date);
  const dateLabel = await dateConvert(date);

  const decorate = async (rows: typeof income) =>
    Promise.all(
      rows.map(async (row) => ({ ...row, amountLabel: await singlePrice(row.balance) })),
    );

  const [incomeRows, expenseRows] = await Promise.all([
    decorate(income),
    decorate(expense),
  ]);

  const [incomeTotal, expenseTotal, netLabel] = await Promise.all([
    singlePrice(income.reduce((sum, r) => sum + r.balance, 0)),
    singlePrice(expense.reduce((sum, r) => sum + r.balance, 0)),
    singlePrice(
      income.reduce((sum, r) => sum + r.balance, 0) -
        expense.reduce((sum, r) => sum + r.balance, 0),
    ),
  ]);

  return (
    <>
      <PageHeader
        title="Daily Income & Expense"
        breadcrumb={[{ label: 'Reports' }, { label: 'Daily Income & Expense' }]}
        actions={
          <SingleDateFilter
            action={ROUTES['income_statement_report.daily']}
            date={date}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Income on ${dateLabel} - ${incomeTotal}`} bodyClassName="">
          <DataTable
            columns={[{ label: 'Account'}, { label:'Amount' }]}
            isEmpty={incomeRows.length === 0}
            empty="No income on this date."
          >
            {incomeRows.map((row) => (
              <Tr key={row.id}>
                <Td>{`${row.name}${row.code ? ` (${row.code})` : ''}`}</Td>
                <Td className="text-right">{row.amountLabel}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        <Card title={`Expense on ${dateLabel} - ${expenseTotal}`} bodyClassName="">
          <DataTable
            columns={[{ label: 'Account'}, { label:'Amount' }]}
            isEmpty={expenseRows.length === 0}
            empty="No expense on this date."
          >
            {expenseRows.map((row) => (
              <Tr key={row.id}>
                <Td>{`${row.name}${row.code ? ` (${row.code})` : ''}`}</Td>
                <Td className="text-right">{row.amountLabel}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <div className="mt-5">
        <Card title="Net for the day">
          <p className="text-2xl font-semibold text-foreground">{netLabel}</p>
        </Card>
      </div>
    </>
  );
}
