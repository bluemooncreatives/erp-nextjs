// Cashbook - port of Modules/Account CashbookController@index
// (`account::cashbook.index`).

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import {
  cashbookCredits,
  cashbookDebits,
  cashbookOpening,
  showroomAccountId,
} from '@/lib/accounting/cashbook';
import { singlePrice } from '@/lib/settings';
import { today, toDateString, phpDate } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card, EmptyState } from '@/components/erp/page';
import { DataTable, Td, Tr, SearchBar } from '@/components/erp/table';

export const metadata: Metadata = { title: 'Cashbook' };

const sum = (rows: Array<{ transaction: { amount: number } }>) =>
  rows.reduce((total, row) => total + row.transaction.amount, 0);

export default async function CashbookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const session = await getSession();

  const date = toDateString(sp.date) ?? today();
  // `date('Y-m-d', strtotime('-1 day', $date))`
  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const previousDate = phpDate('Y-m-d', previous);

  const showroomId = session?.showroomId ?? user.showroomId;
  const accountId = showroomId ? await showroomAccountId(showroomId) : null;

  if (!accountId) {
    return (
      <>
        <PageHeader title="Cashbook" breadcrumb={[{ label: 'Accounts' }, { label: 'Cashbook' }]} />
        <Card title="Cashbook">
          <EmptyState message="This branch has no chart account, so no cashbook can be built." />
        </Card>
      </>
    );
  }

  const [credits, debits, opening] = await Promise.all([
    cashbookCredits(accountId, date),
    cashbookDebits(accountId, date),
    cashbookOpening(accountId, previousDate),
  ]);

  // `$total_transactions->where('type','Cr')->sum() - ->where('type','Dr')->sum()`
  const tillNow =
    opening
      .filter((row) => row.transaction.type === 'Cr')
      .reduce((total, row) => total + row.transaction.amount, 0) -
    opening
      .filter((row) => row.transaction.type === 'Dr')
      .reduce((total, row) => total + row.transaction.amount, 0);

  const creditTotal = sum(credits);
  const debitTotal = sum(debits);
  const todayInHand = creditTotal - debitTotal;

  const [
    openingLabel,
    creditLabel,
    debitLabel,
    inHandLabel,
    closingLabel,
  ] = await Promise.all([
    singlePrice(tillNow),
    singlePrice(creditTotal),
    singlePrice(debitTotal),
    singlePrice(todayInHand),
    singlePrice(tillNow + todayInHand),
  ]);

  const creditRows = await Promise.all(
    credits.map(async (row) => ({ ...row, label: await singlePrice(row.transaction.amount) })),
  );
  const debitRows = await Promise.all(
    debits.map(async (row) => ({ ...row, label: await singlePrice(row.transaction.amount) })),
  );

  return (
    <>
      <PageHeader
        title="Cashbook"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Cashbook' }]}
        actions={
          <SearchBar
            action={ROUTES['cashbook.index']}
            name="date"
            defaultValue={date}
            placeholder="yyyy-mm-dd"
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Debit / Expense"
          desc={`Total ${debitLabel}`}
          bodyClassName=""
        >
          <DataTable
            columns={[{ label: 'Account Name' }, { label: 'Narration' }, { label: 'Amount' }]}
            isEmpty={debitRows.length === 0}
            empty="No payments on this date."
          >
            {debitRows.map((row) => (
              <Tr key={row.transaction.id}>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {row.accountName ?? '-'}
                </Td>
                <Td>{row.voucherNarration ?? row.transaction.narration ?? '-'}</Td>
                <Td>{row.label}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        <Card title="Credit / Income" desc={`Total ${creditLabel}`} bodyClassName="">
          <DataTable
            columns={[{ label: 'Account Name' }, { label: 'Narration' }, { label: 'Amount' }]}
            isEmpty={creditRows.length === 0}
            empty="No receipts on this date."
          >
            {creditRows.map((row) => (
              <Tr key={row.transaction.id}>
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {row.accountName ?? '-'}
                </Td>
                <Td>{row.voucherNarration ?? row.transaction.narration ?? '-'}</Td>
                <Td>{row.label}</Td>
              </Tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <div className="mt-5">
        <Card title="Summary" bodyClassName="">
          <DataTable columns={[{ label: '' }, { label: '' }]} isEmpty={false}>
            <Tr>
              <Td>Opening Balance</Td>
              <Td className="text-right">{openingLabel}</Td>
            </Tr>
            <Tr>
              <Td>Today Total Income</Td>
              <Td className="text-right">{creditLabel}</Td>
            </Tr>
            <Tr>
              <Td>Today Total Expense</Td>
              <Td className="text-right">{debitLabel}</Td>
            </Tr>
            <Tr>
              <Td>Today Balance / Cash in Hand</Td>
              <Td className="text-right">{inHandLabel}</Td>
            </Tr>
            <Tr>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                Today Closing Balance
              </Td>
              <Td className="text-right font-medium text-gray-700 dark:text-gray-300">
                {closingLabel}
              </Td>
            </Tr>
          </DataTable>
        </Card>
      </div>
    </>
  );
}
