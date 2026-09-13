import { LinkButton } from '@/components/common/link-button';
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
import { Badge } from '@/components/erp/badge';
import { ReportSummary } from '@/components/erp/report-summary';
import { Files, Wallet, CircleCheck, Hourglass } from 'lucide-react';
import { deleteExpenseAction } from '../../actions';
import { Phrase } from '@/context/TranslationContext';

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

  const [canCreate, canDelete, canEdit] = await Promise.all([
    can('expenses.store'),
    can('expenses.delete'),
    can('expenses.edit'),
  ]);

  const expenseRows = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      dateLabel: await dateConvert(r.voucher?.date),
    })),
  );

  // Counters lead with the state that needs action, then the money, then the
  // raw total - the figures an approver actually scans this list for.
  const pageValue = expenseRows.reduce((sum, row) => sum + Number(row.voucher?.amount ?? 0), 0);
  const approvedCount = expenseRows.filter((row) => row.voucher?.isApprove === 1).length;
  const pendingCount = expenseRows.length - approvedCount;

  return (
    <>
      <PageHeader
        title="Expense Lists"
        breadcrumb={[{ label: 'Accounts'}, { label:'Expense Lists' }]}
        actions={
          canCreate ? (
            <LinkButton
              href={ROUTES['expenses.create']}
              
            >
              <Phrase>Add Expense</Phrase>
            </LinkButton>
          ) : null
        }
      />

      <ReportSummary
        figures={[
          { label: 'Pending approval', value: pendingCount, detail: 'On this page', icon: Hourglass },
          { label: 'Approved', value: approvedCount, detail: 'On this page', icon: CircleCheck },
          { label: 'Value on this page', value: `${symbol} ${numberFormat(pageValue)}`, detail: `${expenseRows.length} of ${total} records`, icon: Wallet },
          { label: 'Matching records', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Files },
        ]}
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
              <Td className="font-medium text-foreground">
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
                  {row.voucher?.isApprove === 1 ? 'Approved':'Pending'}
                </Badge>
              </Td>
              <Td>
                {canEdit ? <Link className="me-3 text-primary" href={`/account/expenses/${row.expense.id}/edit`}><Phrase>Edit</Phrase></Link> : null}
                {canDelete ? (
                  <form action={deleteExpenseAction}>
                    <input type="hidden" name="id" value={row.expense.id} />
                    <ActionButton confirm="Delete this expense and its voucher?">
                      <Phrase>Delete</Phrase>
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
