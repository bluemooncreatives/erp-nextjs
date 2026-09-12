import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { findVoucher, voucherTransactions } from '@/lib/accounting/vouchers';
import { postableAccounts } from '@/lib/accounting/reports';
import { paymentAccountOptions } from '@/lib/dashboard/queries';
import { generalSetting } from '@/lib/settings';
import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';
import { toDateString, today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { PaymentVoucherForm } from '../../../payment-create/payment-voucher-form';

export const metadata: Metadata = { title: 'Edit Payment Voucher' };

export default async function EditPaymentVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('vouchers.edit');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const voucher = await findVoucher(id);
  if (!voucher || voucher.paymentType !== 'voucher_payment') notFound();
  const [payAccounts, accounts, setting, legs, [document]] = await Promise.all([
    paymentAccountOptions(), postableAccounts(), generalSetting(), voucherTransactions(id),
    db.select().from(documents).where(eq(documents.voucherId, id)).limit(1),
  ]);
  return <>
    <PageHeader title={`Edit Payment ${voucher.txId ?? id}`} breadcrumb={[{ label: 'Accounts' }, { label: 'Payment Voucher' }]} />
    <PaymentVoucherForm heading="Voucher Details" paymentType="voucher_payment" currencySymbol={setting.currencySymbol ?? '$'}
      payAccounts={payAccounts.map((account) => ({ value: account.id, label: `${account.name} (${account.code})` }))}
      allAccounts={accounts.map((account) => ({ value: account.id, label: `${account.name} (${account.code})` }))}
      defaults={{ id, voucherType: voucher.voucherType ?? 'CV', date: toDateString(voucher.date) ?? today(),
        creditAccountId: legs.find((leg) => leg.type === 'Cr')?.accountId ?? 0,
        lines: legs.filter((leg) => leg.type === 'Dr').map((leg) => ({ accountId: String(leg.accountId), amount: Number(leg.amount), narration: leg.narration ?? '' })),
        narration: voucher.narration, bankName: document?.bankName, bankBranch: document?.bankBranch,
        chequeNo: document?.chequeNo, chequeDate: toDateString(document?.chequeDate),
      }} />
  </>;
}
