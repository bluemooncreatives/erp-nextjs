import { LinkButton } from '@/components/common/link-button';
// Income list - port of IncomeController@index.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { getSession } from '@/lib/auth/session';
import { listIncomes } from '@/lib/accounting/expenses';
import { dateConvert, generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { ReportSummary } from '@/components/erp/report-summary';
import { Files, Wallet, ListFilter } from 'lucide-react';
import { DataTable, Pagination, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
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

  const [canCreate, canDelete, canEdit] = await Promise.all([
    can('income.store'),
    can('income.delete'),
    can('income.edit'),
  ]);

  const incomeRows = await Promise.all(
    rows.map(async (r) => ({ ...r, dateLabel: await dateConvert(r.voucher?.date) })),
  );

  // No approval state on income, so the honest summary is volume and value.
  const pageValue = incomeRows.reduce((sum, row) => sum + Number(row.voucher?.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Income Lists"
        breadcrumb={[{ label: 'Accounts'}, { label:'Income Lists' }]}
        actions={
          canCreate ? (
            <LinkButton
              href={ROUTES['income.create']}
              
            >
              Add Income
            </LinkButton>
          ) : null
        }
      />

      <ReportSummary
        figures={[
          { label: 'Value on this page', value: `${symbol} ${numberFormat(pageValue)}`, icon: Wallet, detail: 'Sum of the rows below' },
          { label: 'Income records', value: total.toLocaleString('en-US'), detail: 'Across all pages', icon: Files },
          { label: 'Showing now', value: incomeRows.length, detail: 'Records on this page', icon: ListFilter },
        ]}
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
              <Td className="font-medium text-foreground">
                {row.voucher?.txId ?? '-'}
              </Td>
              <Td>{row.dateLabel}</Td>
              <Td>{row.showroomName ?? '-'}</Td>
              <Td>{row.accountName ?? '-'}</Td>
              <Td className="max-w-xs truncate">{row.voucher?.narration ?? '-'}</Td>
              <Td>{`${symbol} ${numberFormat(row.voucher?.amount ?? 0)}`}</Td>
              <Td>
                {canEdit ? <Link className="me-3 text-primary" href={`/account/income/${row.income.id}/edit`}>Edit</Link> : null}
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
