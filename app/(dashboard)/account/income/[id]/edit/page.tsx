import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { incomes } from '@/lib/db/schema';
import { incomeAccounts } from '@/lib/accounting/income';
import { findVoucher, voucherTransactions } from '@/lib/accounting/vouchers';
import { toDateString, today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { IncomeForm } from '../../form';
export default async function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('income.edit');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [income] = await db.select().from(incomes).where(eq(incomes.id, id)).limit(1);
  if (!income?.voucherId) notFound();
  const [voucher, legs, accounts] = await Promise.all([findVoucher(income.voucherId), voucherTransactions(income.voucherId), incomeAccounts()]);
  if (!voucher) notFound();
  return <><PageHeader title="Edit Income" /><IncomeForm accounts={accounts.map((row) => ({ value: row.id, label: `${row.name} (${row.code})` }))} defaults={{ id, accountId: voucher.accountId ?? legs.at(-1)?.accountId ?? income.accountId ?? 0,
    amount: Number(voucher.amount), date: toDateString(voucher.date) ?? today(), narration: voucher.narration, note: legs.at(-1)?.narration ?? null }} /></>;
}
