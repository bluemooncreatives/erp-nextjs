// Bank accounts - port of BankAccountController.

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { listBankAccounts } from '@/lib/accounting/expenses';
import { accountBalances } from '@/lib/accounting/reports';
import { generalSetting, numberFormat } from '@/lib/settings';
import { ROUTES } from '@/lib/routes';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { deleteBankAccountAction } from '../actions';
import { BankAccountForm } from './bank-account-form';

export const metadata: Metadata = { title: 'Bank Accounts' };

export default async function BankAccountsPage() {
  await authorize('bank_accounts.index');
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [rows, balances] = await Promise.all([listBankAccounts(), accountBalances()]);
  const balanceById = new Map(balances.map((b) => [b.id, b.balance]));

  const [canCreate, canDelete, canEdit, canHistory] = await Promise.all([
    can('bank_accounts.store'),
    can('bank_accounts.delete'),
    can('bank_accounts.edit'),
    can('bank.account.history'),
  ]);

  return (
    <>
      <PageHeader
        title="Bank Accounts"
        breadcrumb={[{ label: 'Accounts' }, { label: 'Bank Accounts' }]}
        actions={
          <Link
            href={ROUTES['bank.account.csv_upload']}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            Upload via CSV
          </Link>
        }
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate ? (
          <div className="col-span-12 xl:col-span-4">
            <BankAccountForm />
          </div>
        ) : null}

        <div className={canCreate ? 'col-span-12 xl:col-span-8' : 'col-span-12'}>
          <Card title={`Bank Accounts (${rows.length})`} bodyClassName="">
            <DataTable
              columns={[
                { label: 'Bank' },
                { label: 'Branch' },
                { label: 'Account name' },
                { label: 'Account no' },
                { label: 'Balance' },
                { label: 'Action' },
              ]}
              isEmpty={rows.length === 0}
              empty="No bank accounts found."
            >
              {rows.map((row) => (
                <Tr key={row.account.id}>
                  <Td className="font-medium text-gray-700 dark:text-gray-300">
                    {row.account.bankName}
                  </Td>
                  <Td>{row.account.branchName ?? '-'}</Td>
                  <Td>{row.account.accountName ?? '-'}</Td>
                  <Td>{row.account.accountNo ?? '-'}</Td>
                  <Td>
                    {`${symbol} ${numberFormat(
                      balanceById.get(row.account.chartAccountId) ?? 0,
                    )}`}
                  </Td>
                  <Td>
                    {canEdit ? <Link className="mr-3 text-brand-500" href={`/account/bank_accounts/${row.account.id}/edit`}>Edit</Link> : null}
                    {canHistory ? <Link className="mr-3 text-brand-500" href={`/account/bank_accounts/history/${row.account.id}`}>History</Link> : null}
                    {canDelete ? (
                      <form action={deleteBankAccountAction}>
                        <input type="hidden" name="id" value={row.account.id} />
                        <ActionButton
                          confirm={`Delete "${row.account.bankName}" and its ledger account?`}
                        >
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
          </Card>
        </div>
      </div>
    </>
  );
}
