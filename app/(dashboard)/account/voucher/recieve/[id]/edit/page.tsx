import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { receiveByAccounts, receiveFromAccounts } from '@/lib/accounting/accounts';
import { findVoucher, voucherTransactions } from '@/lib/accounting/vouchers';
import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';
import { toDateString, today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { ReceiptVoucherForm } from '../../form';

export const metadata: Metadata = { title: 'Edit Receipt Voucher' };

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('voucher_recieve.edit');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const voucher = await findVoucher(id);
  if (!voucher || voucher.paymentType !== 'voucher_recieve') notFound();
  const [from, by, legs, [document]] = await Promise.all([
    receiveFromAccounts(), receiveByAccounts(), voucherTransactions(id),
    db.select().from(documents).where(eq(documents.voucherId, id)).limit(1),
  ]);
  return <>
    <PageHeader title={`Edit Receipt ${voucher.txId ?? id}`} breadcrumb={[{ label: 'Accounts' }, { label: 'Receipt Voucher' }]} />
    <ReceiptVoucherForm defaults={{
      id, date: toDateString(voucher.date) ?? today(), amount: Number(voucher.amount),
      creditAccountId: legs.find((leg) => leg.type === 'Cr')?.accountId ?? undefined,
      debitAccountId: legs.find((leg) => leg.type === 'Dr')?.accountId ?? undefined,
      narration: voucher.narration, bankName: document?.bankName, bankBranch: document?.bankBranch,
      chequeNo: document?.chequeNo, chequeDate: toDateString(document?.chequeDate),
    }}
      fromAccounts={from.map((account) => ({ value: account.id, label: `${account.name} (${account.code})` }))}
      byAccounts={by.map((account) => ({ value: account.id, label: `${account.name} (${account.code})`, group: account.configurationGroupId }))} />
  </>;
}
