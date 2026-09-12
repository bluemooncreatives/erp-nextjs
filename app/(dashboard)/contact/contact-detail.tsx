// Contact profile - port of contact::contact.supplier_view (ContactController@show)
// and contact::contact.customer_view (ContactController@customer_details).
//
// Both Blades share a layout: a profile table, invoice/finance summaries, and a
// tabbed list of invoices, returns and account transactions, with the add- and
// subtract-balance modals underneath.

import Link from 'next/link';
import Image from 'next/image';
import {
  contactAccounts,
  contactStatement,
  customerReturns,
  supplierReturns,
  type ContactAccounts,
} from '@/lib/contact/queries';
import { customerSaleHistory, supplierPurchaseHistory } from '@/lib/contact/repository';
import { findContactAccount, receiveByAccounts } from '@/lib/accounting/accounts';
import { expenseAccounts } from '@/lib/accounting/expenses';
import { transactionalAccounts } from '@/lib/accounting/journal';
import { MorphType } from '@/lib/db/morph';
import { ConfigurationGroup } from '@/lib/accounting/accounts';
import { generalSetting, numberFormat, dateConvert } from '@/lib/settings';
import { avatarUrl } from '@/lib/paths';
import { route } from '@/lib/routes';
import { can } from '@/lib/auth/permissions';
import { Card, DetailList, PageHeader } from '@/components/erp/page';
import { DataTable, StatusBadge, Td, Tr } from '@/components/erp/table';
import { Tabs } from '@/components/erp/tabs';
import { AddBalanceForm, SubtractBalanceForm } from './balance-forms';
import {
  addCustomerBalance,
  addSupplierBalance,
  subtractContactBalance,
} from './balance-actions';
import type { ContactsRow } from '@/lib/db/schema';

function money(symbol: string, value: number | string | null | undefined) {
  return `${symbol} ${numberFormat(value)}`;
}

function PaidStatus({ status }: { status: number | null }) {
  const label = status === 1 ? 'Paid' : status === 2 ? 'Partial' : 'Unpaid';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        status === 1
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {label}
    </span>
  );
}

export async function ContactDetail({
  contact,
  variant,
}: {
  contact: ContactsRow;
  variant: 'customer' | 'supplier';
}) {
  const setting = await generalSetting();
  const symbol = setting.currencySymbol ?? '$';

  const isCustomer = variant === 'customer';

  const [accounts, statement, invoices, returns, chartAccount] = await Promise.all([
    contactAccounts(contact),
    contactStatement(contact),
    isCustomer ? customerSaleHistory(contact.id) : supplierPurchaseHistory(contact.id),
    isCustomer ? customerReturns(contact.id) : supplierReturns(contact.id),
    findContactAccount(contact.id, MorphType.ContactModel),
  ]);

  // The customer modal offers expense accounts to subtract against; the
  // supplier one every postable account (`expenseAccounts()` vs
  // `transactionalAccounts()` in the controller).
  const [balanceAccounts, subtractAccounts, canEdit] = await Promise.all([
    receiveByAccounts(),
    isCustomer ? expenseAccounts() : transactionalAccounts(),
    can('add_contact.edit'),
  ]);

  const approved = invoices.filter((row) =>
    isCustomer
      ? (row as { isApproved: number | null }).isApproved === 1
      : (row as { status: number | null }).status === 1,
  );

  const totalApproved = approved.reduce(
    (sum, row) => sum + Number((row as { payableAmount: string | number | null }).payableAmount ?? 0),
    0,
  );

  const summary: ContactAccounts = accounts;

  const invoicePanel = (
    <Card
      title={isCustomer ? 'Invoices':'Purchase Invoices'}
      bodyClassName=""
    >
      <DataTable
        columns={[
          { label: '#' },
          { label: 'Date' },
          { label: 'Invoice' },
          { label: 'Reference No' },
          { label: 'Approval' },
          { label: 'Paid Status' },
          { label: 'Total Amount' },
        ]}
        isEmpty={approved.length === 0}
        empty="No invoices found."
      >
        {approved.map((row, index) => {
          const r = row as unknown as {
            id: number;
            invoiceNo: string | null;
            referenceNo: string | null;
            date: string | null;
            paidStatus: number | null;
            payableAmount: string | number | null;
          };
          return (
            <Tr key={r.id}>
              <Td>{index + 1}</Td>
              <Td>{r.date ?? '-'}</Td>
              <Td>
                <Link
                  className="text-primary"
                  href={
                    isCustomer
                      ? route('sale.show', { id: r.id })
                      : route('purchase_order.show', { id: r.id })
                  }
                >
                  {r.invoiceNo ?? r.id}
                </Link>
              </Td>
              <Td>{r.referenceNo ?? '-'}</Td>
              <Td>
                <StatusBadge status={1} />
              </Td>
              <Td>
                <PaidStatus status={r.paidStatus} />
              </Td>
              <Td>{money(symbol, r.payableAmount)}</Td>
            </Tr>
          );
        })}
      </DataTable>
      <div className="border-t border-border px-5 py-3 text-sm font-medium text-foreground">
        {isCustomer ? 'Total Sale' : 'Total Purchase'}: {money(symbol, totalApproved)}
      </div>
    </Card>
  );

  const returnPanel = (
    <Card title="Returns" bodyClassName="">
      <DataTable
        columns={[
          { label: '#' },
          { label: 'Date' },
          { label: 'Reference No' },
          { label: 'Paid Status' },
          { label: 'Total Amount' },
        ]}
        isEmpty={returns.length === 0}
        empty="No returns found."
      >
        {returns.map((row, index) => {
          const r = row as unknown as {
            id: number;
            referenceNo: string | null;
            date: string | null;
            paidStatus: number | null;
            payableAmount: string | number | null;
          };
          return (
            <Tr key={r.id}>
              <Td>{index + 1}</Td>
              <Td>{r.date ?? '-'}</Td>
              <Td>{r.referenceNo ?? '-'}</Td>
              <Td>
                <PaidStatus status={r.paidStatus} />
              </Td>
              <Td>{money(symbol, r.payableAmount)}</Td>
            </Tr>
          );
        })}
      </DataTable>
    </Card>
  );

  const transactionPanel = (
    <Card title="Transactions" bodyClassName="">
      <DataTable
        columns={[
          { label: 'Date' },
          { label: 'Narration' },
          { label: 'Invoice' },
          { label: 'Debit' },
          { label: 'Credit' },
          { label: 'Balance' },
        ]}
        isEmpty={statement.rows.length === 0}
        empty="No transactions found."
      >
        {statement.rows.map((row) => (
          <Tr key={row.id}>
            <Td>{row.date ?? '-'}</Td>
            <Td>{row.narration ?? '-'}</Td>
            <Td>{row.invoiceNo ?? '-'}</Td>
            <Td>{row.type === 'Dr' ? money(symbol, row.amount) : '-'}</Td>
            <Td>{row.type === 'Cr' ? money(symbol, row.amount) : '-'}</Td>
            <Td>{money(symbol, row.balance)}</Td>
          </Tr>
        ))}
      </DataTable>
      <div className="border-t border-border px-5 py-3 text-sm font-medium text-foreground">
        Opening: {money(symbol, statement.opening)} &middot; Closing:{''}
        {money(symbol, statement.closing)}
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={`${isCustomer ? 'Customer' : 'Supplier'} Profile`}
        breadcrumb={[
          {
            label: 'Contacts',
            href: isCustomer ? route('customer') : route('supplier'),
          },
          { label: contact.name },
        ]}
        actions={
          canEdit ? (
            <Link
              href={route('add_contact.edit', { id: contact.id })}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary"
            >
              Edit
            </Link>
          ) : null
        }
      />

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Profile" className="lg:col-span-2">
            <div className="flex flex-wrap items-start gap-6">
              <Image
                src={avatarUrl(contact.avatar, contact.name)}
                alt={contact.name}
                width={72}
                height={72}
                className="rounded-full object-cover"
                unoptimized
              />
              <DetailList
                columns={2}
                items={[
                  { label: 'Name', value: contact.name },
                  { label: 'Email', value: contact.email ?? '-' },
                  { label: 'Phone', value: contact.mobile ?? '-' },
                  { label: 'Pay Term', value: contact.payTerm ?? '-' },
                  { label: 'Pay Condition', value: contact.payTermCondition ?? '-' },
                  { label: 'Address', value: contact.address ?? '-' },
                  { label: 'State', value: contact.state ?? '-' },
                  { label: 'City', value: contact.city ?? '-' },
                  { label: 'Tax Number', value: contact.taxNumber ?? '-' },
                  {
                    label: 'Opening Balance',
                    value: money(symbol, contact.openingBalance),
                  },
                  {
                    label: 'Registered Date',
                    value: contact.createdAt ? await dateConvert(contact.createdAt) : '-',
                  },
                  {
                    label: 'Active Status',
                    value: <StatusBadge status={contact.isActive} />,
                  },
                ]}
              />
            </div>
          </Card>

          <div className="space-y-5">
            <Card title={isCustomer ? 'Sale Information':'Purchase Information'}>
              <DetailList
                columns={1}
                items={[
                  { label: 'Total Invoice', value: summary.totalInvoice },
                  { label: 'Due Invoice', value: summary.dueInvoice },
                ]}
              />
              <Link
                href={
                  isCustomer
                    ? route('customerSaleProductList', { id: contact.id })
                    : route('supplierPurchaseProductList', { id: contact.id })
                }
                className="mt-4 inline-block rounded-lg px-4 py-2.5 text-sm font-medium text-primary ring-1 ring-inset ring-ring/50 hover:bg-primary/10"
              >
                Products
              </Link>
            </Card>

            <Card title="Finance Information">
              <DetailList
                columns={1}
                items={[
                  {
                    label: isCustomer ? 'Total Sale' : 'Total Purchase',
                    value: money(symbol, summary.total),
                  },
                  { label: 'Paid', value: money(symbol, summary.paid) },
                  { label: 'Due Balance', value: money(symbol, summary.due) },
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {isCustomer
                  ? 'Total Sale = Sale + Opening Balance'
                  : 'Total Purchase = Purchase + Opening Balance'}
              </p>
            </Card>
          </div>
        </div>

        <Tabs
          orientation="horizontal"
          tabs={[
            { id: 'invoice', label:'Invoice', content: invoicePanel },
            { id: 'return', label:'Return', content: returnPanel },
            { id: 'transactions', label:'Transactions', content: transactionPanel },
          ]}
        />

        {chartAccount ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <AddBalanceForm
              action={isCustomer ? addCustomerBalance : addSupplierBalance}
              contactId={contact.id}
              contactAccountName={chartAccount.name ?? contact.name}
              accounts={balanceAccounts.map((a) => ({
                value: a.id,
                label: a.name ?? String(a.id),
                isBank: a.configurationGroupId === ConfigurationGroup.Bank,
              }))}
              accountField={isCustomer ? 'debit_account_id':'credit_account_id'}
              accountLabel={isCustomer ? 'Received By' : 'Payment From Account'}
              contactFieldLabel={isCustomer ? 'Received From' : 'Paid To'}
              title="Add Balance"
            />
            <SubtractBalanceForm
              action={subtractContactBalance}
              contactId={contact.id}
              contactAccountName={chartAccount.name ?? contact.name}
              accounts={subtractAccounts.map((a) => ({
                value: a.id,
                label: a.name ?? String(a.id),
              }))}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
