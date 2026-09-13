import { LinkButton } from '@/components/common/link-button';
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
import { ReportSummary } from '@/components/erp/report-summary';
import { Building2, Landmark, TrendingDown, Wallet } from 'lucide-react';
import { BankAccountForm } from './bank-account-form';
import { Phrase } from '@/context/TranslationContext';

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

  const accountBalanceOf = (row: (typeof rows)[number]) =>
    balanceById.get(row.account.chartAccountId) ?? 0;

  const heldTotal = rows.reduce((sum, row) => sum + accountBalanceOf(row), 0);
  // An overdrawn account is worth surfacing above the table rather than
  // leaving it to be spotted by scanning the balance column.
  const overdrawnCount = rows.filter((row) => accountBalanceOf(row) < 0).length;
  const bankCount = new Set(rows.map((row) => row.account.bankName).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="Bank Accounts"
        breadcrumb={[{ label: 'Accounts'}, { label:'Bank Accounts' }]}
        actions={
          <LinkButton
            href={ROUTES['bank.account.csv_upload']}
            
          >
            Upload via CSV
          </LinkButton>
        }
      />

      <ReportSummary
        figures={[
          { label: 'Accounts', value: rows.length, detail: 'Linked to the ledger', icon: Landmark },
          { label: 'Banks', value: bankCount, detail: 'Distinct institutions', icon: Building2 },
          {
            label: 'Total held',
            value: `${symbol} ${numberFormat(heldTotal)}`,
            detail: 'Across every account',
            icon: Wallet,
          },
          { label: 'Overdrawn', value: overdrawnCount, detail: 'Accounts below zero', icon: TrendingDown },
        ]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate ? (
          <div className="col-span-12 xl:col-span-4">
            <BankAccountForm />
          </div>
        ) : null}

        <div className={canCreate ? 'col-span-12 xl:col-span-8':'col-span-12'}>
          <Card title="All bank accounts" bodyClassName="">
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
                  <Td className="font-medium text-foreground">
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
                    {canEdit ? <Link className="me-3 text-primary" href={`/account/bank_accounts/${row.account.id}/edit`}><Phrase>Edit</Phrase></Link> : null}
                    {canHistory ? <Link className="me-3 text-primary" href={`/account/bank_accounts/history/${row.account.id}`}>History</Link> : null}
                    {canDelete ? (
                      <form action={deleteBankAccountAction}>
                        <input type="hidden" name="id" value={row.account.id} />
                        <ActionButton
                          confirm={`Delete "${row.account.bankName}" and its ledger account?`}
                        >
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
          </Card>
        </div>
      </div>
    </>
  );
}
