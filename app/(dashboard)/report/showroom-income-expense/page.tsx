// Showroom income & expense - port of
// IncomeStateMentController@showroom_income_expense_report, which listed the
// approved movement on every branch's own chart account.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { branchTransactions, showroomAccountIds } from '@/lib/reports/statements';
import { dateConvert, singlePrice } from '@/lib/settings';
import { toDateString, today } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { FormAlert } from '@/components/erp/fields';
import { DateRangeFilter } from '../period-filter';

export const metadata: Metadata = { title: 'Showroom Income & Expense' };

export default async function ShowroomIncomeExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; date?: string }>;
}) {
  await authorize('showroom_income_expense_report.daily');
  const sp = await searchParams;

  const from = toDateString(sp.dateFrom);
  const to = toDateString(sp.dateTo);

  const warning =
    from && !to
      ? 'You need to set date-to when you select date-to.'
      : to && !from
        ? 'You need to set date-from when you select date-to.'
        : null;

  // With no range, the controller reported a single day.
  const singleDate = toDateString(sp.date) ?? today();
  const range =
    from && to && !warning
      ? { from, to }
      : { from: singleDate, to: singleDate };

  const accountIds = await showroomAccountIds();
  const rows = await branchTransactions(accountIds, range.from, range.to);

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      amountLabel: await singlePrice(row.amount),
      dateLabel: await dateConvert(row.date),
    })),
  );

  const debit = rows
    .filter((r) => r.type === 'Dr')
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const credit = rows
    .filter((r) => r.type === 'Cr')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const [debitLabel, creditLabel, netLabel] = await Promise.all([
    singlePrice(debit),
    singlePrice(credit),
    singlePrice(debit - credit),
  ]);

  // `$transactions->unique('account_id')`
  const accountCount = new Set(rows.map((r) => r.accountId)).size;

  return (
    <>
      <PageHeader
        title="Showroom Income & Expense"
        breadcrumb={[{ label: 'Reports' }, { label: 'Showroom Income & Expense' }]}
        actions={
          <DateRangeFilter
            action={ROUTES['showroom_income_expense_report.daily']}
            from={from ?? undefined}
            to={to ?? undefined}
          />
        }
      />

      {warning ? (
        <div className="mb-5">
          <FormAlert variant="warning" message={warning} />
        </div>
      ) : null}

      <Card
        title={`Transactions (${rows.length}) across ${accountCount} branch accounts`}
        desc={`Debit ${debitLabel} · Credit ${creditLabel} · Net ${netLabel}`}
        bodyClassName=""
      >
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Account' },
            { label: 'Narration' },
            { label: 'Type' },
            { label: 'Amount' },
          ]}
          isEmpty={decorated.length === 0}
          empty="No branch movement in this period."
        >
          {decorated.map((row) => (
            <Tr key={row.id}>
              <Td>{row.dateLabel}</Td>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {`${row.accountName ?? '-'}${row.accountCode ? ` (${row.accountCode})` : ''}`}
              </Td>
              <Td>{row.narration ?? '-'}</Td>
              <Td>{row.type}</Td>
              <Td className="text-right">{row.amountLabel}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
