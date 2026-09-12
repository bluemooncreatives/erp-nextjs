import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { expenses } from '@/lib/db/schema';
import { expenseAccounts } from '@/lib/accounting/expenses';
import { findVoucher, voucherTransactions } from '@/lib/accounting/vouchers';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { toDateString, today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { VoucherForm } from '../../../voucher-form';
import { updateExpenseAction } from '../../../actions';

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('expenses.edit');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!expense?.voucherId) notFound();
  const [voucher, legs, accounts, paying, setting] = await Promise.all([findVoucher(expense.voucherId), voucherTransactions(expense.voucherId), expenseAccounts(), paymentAccountOptions(), generalSetting()]);
  if (!voucher || !legs.length) notFound();
  return <><PageHeader title="Edit Expense" /><VoucherForm action={updateExpenseAction} heading="Expense Details"
    mainAccountLabel="Main account" mainAccounts={paying.map((row) => ({ value: row.id, label: `${row.name} (${row.code})` }))}
    lineAccountLabel="Expense account" lineAccounts={accounts.map((row) => ({ value: row.id, label: `${row.name} (${row.code})` }))}
    currencySymbol={setting.currencySymbol ?? '$'} cancelHref="/account/expenses/index" submitLabel="Update Expense" showPaymentMethod={false}
    defaults={{ id, accountId: legs.at(-1)?.accountId, date: toDateString(voucher.date) ?? today(), narration: voucher.narration,
      lines: legs.slice(0, -1).map((leg) => ({ accountId: leg.accountId ?? 0, amount: Number(leg.amount), narration: leg.narration })) }} />
  </>;
}
