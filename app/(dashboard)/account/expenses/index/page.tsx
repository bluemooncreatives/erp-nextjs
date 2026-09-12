// Expense list - port of ExpenseController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listExpenses } from '@/lib/accounting/expenses';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import { deleteExpenseAction } from '../../actions';

export const metadata: Metadata = { title: 'Expense Lists' };

export default async function ExpenseListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await authorize('expenses.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const canSeeAll = user.role.type === 'system_user' || (await can('expenses.show'));

  const { rows, total, page, perPage } = await listExpenses({
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: canSeeAll,
  });

  const [canCreate, canDelete] = await Promise.all([
    can('expenses.store'),
    can('expenses.delete'),
  ]);

  const expenseRows = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      dateLabel: await dateConvert(r.voucher?.date),
    })),
  );

  return (
    <>
      <PageHeader
        title="Expense Lists"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Expense Lists' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['expenses.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Expense
            </Link>
          ) : null
        }
      />

      <Card title={`Expenses (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Voucher' },
            { label: 'Date' },
            { label: 'Branch' },
            { label: 'Narration' },
            { label: 'Amount' },
            { label: 'Approval' },
            { label: 'Action' },
          ]}
          isEmpty={expenseRows.length === 0}
          empty="No expenses found."
        >
          {expenseRows.map((row) => (
            <Tr key={row.expense.id}>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {row.voucher?.txId ?? '-'}
              </Td>
              <Td>{row.dateLabel}</Td>
              <Td>{row.showroomName ?? '-'}</Td>
              <Td className="max-w-xs truncate">{row.voucher?.narration ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(row.voucher?.amount ?? 0)}`}</Td>
              <Td>
                <Badge
                  size="sm"
                  color={row.voucher?.isApprove === 1 ? 'success' : 'warning'}
                >
                  {row.voucher?.isApprove === 1 ? 'Approved' : 'Pending'}
                </Badge>
              </Td>
              <Td>
                {canDelete ? (
                  <form action={deleteExpenseAction}>
                    <input type="hidden" name="id" value={row.expense.id} />
                    <ActionButton confirm="Delete this expense and its voucher?">
                      Delete
                    </ActionButton>
                  </form>
                ) : (
                  '-'
                )}
              </Td>
            </Tr>
          ))}
        </DataTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={total}
          baseUrl={ROUTES['expenses.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
