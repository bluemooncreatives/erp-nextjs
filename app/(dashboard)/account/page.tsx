// Chart of accounts - port of ChartAccountController@index (`char_accounts.index`,
// which the PHP served at `/account/`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { authorize, can } from '@/lib/auth/permissions';
import { accountTree, accountTypeName, type AccountTreeNode } from '@/lib/accounting/accounts';
import { accountBalances } from '@/lib/accounting/reports';
import { generalSetting, numberFormat } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ActionButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { deleteChartAccountAction } from './actions';
import { ReportSummary } from '@/components/erp/report-summary';
import { FolderTree, ListTree, Power, Wallet } from 'lucide-react';
import { ChartAccountForm } from './chart-account-form';

export const metadata: Metadata = { title: 'Chart Of Accounts' };

export default async function ChartOfAccountsPage() {
  await authorize('char_accounts.index');
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const [tree, balances] = await Promise.all([accountTree(), accountBalances()]);
  const balanceById = new Map(balances.map((b) => [b.id, b.balance]));

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('char_accounts.store'),
    can('char_accounts.edit'),
    can('char_accounts.destroy'),
  ]);

  // Flatten the tree so the table can show the hierarchy by indentation.
  const flat: Array<{ node: AccountTreeNode; depth: number }> = [];
  const walk = (nodes: AccountTreeNode[], depth: number) => {
    for (const node of nodes) {
      flat.push({ node, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);

  const parentOptions = balances
    .filter((b) => b.isGroup === 1)
    .map((b) => ({ value: b.id, label: `${b.name}${b.code ? ` (${b.code})` : ''}` }));

  const groupCount = flat.filter((entry) => entry.node.isGroup === 1).length;
  const inactiveCount = flat.filter((entry) => entry.node.status !== 1).length;
  // Group rows carry their children's totals, so summing every row would
  // count the same money twice - only the leaves are added up here.
  const ledgerTotal = flat
    .filter((entry) => entry.node.isGroup === 0)
    .reduce((sum, entry) => sum + (balanceById.get(entry.node.id) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Chart Of Accounts"
        breadcrumb={[{ label: 'Accounts'}, { label:'Chart Of Accounts' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Accounts', value: flat.length, detail: 'Groups and ledgers', icon: ListTree },
          { label: 'Groups', value: groupCount, detail: 'Headings with children', icon: FolderTree },
          {
            label: 'Ledger balance',
            value: `${symbol} ${numberFormat(ledgerTotal)}`,
            detail: 'Summed across posting accounts',
            icon: Wallet,
          },
          { label: 'Inactive', value: inactiveCount, detail: 'Switched off', icon: Power },
        ]}
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {canCreate || canEdit ? (
          <div className="col-span-12 xl:col-span-4">
            <ChartAccountForm parents={parentOptions} />
          </div>
        ) : null}

        <div className={canCreate || canEdit ? 'col-span-12 xl:col-span-8':'col-span-12'}>
          <Card title="All accounts" bodyClassName="">
            <DataTable
              columns={[
                { label: 'Account' },
                { label: 'Code' },
                { label: 'Type' },
                { label: 'Balance' },
                { label: 'Status' },
                { label: 'Action' },
              ]}
              isEmpty={flat.length === 0}
              empty="No accounts found."
            >
              {flat.map(({ node, depth }) => (
                <Tr key={node.id}>
                  <Td>
                    <span
                      style={{ paddingLeft: `${depth * 16}px` }}
                      className={
                        node.isGroup === 1
                          ? 'font-semibold text-foreground '
                          : 'text-muted-foreground '
                      }
                    >
                      {node.name}
                    </span>
                  </Td>
                  <Td>{node.code ?? '-'}</Td>
                  <Td>{accountTypeName(node.type)}</Td>
                  <Td>{`${symbol} ${numberFormat(balanceById.get(node.id) ?? 0)}`}</Td>
                  <Td>
                    <Badge size="sm" color={node.status === 1 ? 'success' : 'error'}>
                      {node.status === 1 ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    {canEdit ? <Link className="me-3 text-primary" href={`/account/chart-account/${node.id}/edit`}>Edit</Link> : null}
                    {canDelete && node.isGroup === 0 ? (
                      <form action={deleteChartAccountAction}>
                        <input type="hidden" name="id" value={node.id} />
                        <ActionButton confirm={`Delete account "${node.name}"?`}>
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
