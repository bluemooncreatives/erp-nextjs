// Income list - port of IncomeController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listIncomes } from '@/lib/accounting/expenses';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import Badge from '@/components/ui/badge/Badge';
import { deleteIncomeAction } from '../actions';

export const metadata: Metadata = { title: 'Income Lists' };

export default async function IncomeListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await authorize('income.index');
  const sp = await searchParams;
  const session = await getSession();
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const { rows, total, page, perPage } = await listIncomes({
    page: Number(sp.page ?? 1),
    showroomId: session?.showroomId ?? user.showroomId,
    allBranches: user.role.type === 'system_user',
  });

  const [canCreate, canDelete] = await Promise.all([
    can('income.store'),
    can('income.delete'),
  ]);

  const incomeRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.voucher?.date) })),
  );

  return (
    <>
      <PageHeader
        title="Income Lists"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Income Lists' }]}
        actions={
          canCreate ? (
            <Link
              href={ROUTES['income.create']}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Add Income
            </Link>
          ) : null
        }
      />

      <Card title={`Income (${total})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'Voucher' },
            { label: 'Date' },
            { label: 'Branch' },
            { label: 'Received into' },
            { label: 'Narration' },
            { label: 'Amount' },
            { label: 'Action' },
          ]}
          isEmpty={incomeRows.length === 0}
          empty="No income records found."
        >
          {incomeRows.map((row) => (
            <Tr key={row.income.id}>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {row.voucher?.txId ?? '-'}
              </Td>
              <Td>{row.dateLabel}</Td>
              <Td>{row.showroomName ?? '-'}</Td>
              <Td>{row.accountName ?? '-'}</Td>
              <Td className="max-w-xs truncate">{row.voucher?.narration ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(row.voucher?.amount ?? 0)}`}</Td>
              <Td>
                {canDelete ? (
                  <form action={deleteIncomeAction}>
                    <input type="hidden" name="id" value={row.income.id} />
                    <ActionButton confirm="Delete this income and its voucher?">
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
          baseUrl={ROUTES['income.index']}
          params={sp}
        />
      </Card>
    </>
  );
}
