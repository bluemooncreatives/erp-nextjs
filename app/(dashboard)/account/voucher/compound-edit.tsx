import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findVoucher, voucherTransactions } from '@/lib/accounting/vouchers';
import { activeAccounts } from '@/lib/accounting/journal';
import { generalSetting } from '@/lib/settings';
import { toDateString, today } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { VoucherForm } from '../voucher-form';
import { updateContraVoucherAction, updateJournalVoucherAction } from '../actions';

export async function CompoundVoucherEdit({ id, kind }: { id: number; kind: 'journal' | 'contra' }) {
  await authorize(`${kind}.edit`);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const voucher = await findVoucher(id);
  const paymentType = kind === 'journal' ? 'journal_voucher' : 'contra_voucher';
  if (!voucher || voucher.paymentType !== paymentType) notFound();
  const [accounts, legs, setting] = await Promise.all([activeAccounts(), voucherTransactions(id), generalSetting()]);
  // The PHP journal editor's last() conflicts with JournalRepository's
  // array_unshift. Read the actual stored main leg so editing preserves the
  // postings. ContraRepository appends the main leg instead.
  const main = kind === 'journal' ? legs[0] : legs.at(-1);
  if (!main?.accountId) notFound();
  const subLegs = kind === 'journal' ? legs.slice(1).reverse() : legs.slice(0, -1);
  const options = accounts.map((account) => ({ value: account.id, label: `${account.name} (${account.code})` }));
  const title = kind === 'journal' ? 'Journal' : 'Contra Voucher';
  return <>
    <PageHeader title={`Edit ${title} ${voucher.txId ?? id}`} breadcrumb={[{ label: 'Accounts' }, { label: title }]} />
    <VoucherForm action={kind === 'journal' ? updateJournalVoucherAction : updateContraVoucherAction}
      heading={`${title} Details`} mainAccountLabel="Main account" mainAccounts={options}
      lineAccountLabel="Contra account" lineAccounts={options} currencySymbol={setting.currencySymbol ?? '$'}
      cancelHref={kind === 'journal' ? ROUTES['journal.index'] : ROUTES['contra.index']}
      submitLabel={`Update ${title}`} showPaymentMethod={false} showAccountTypeToggle
      defaults={{ id, accountId: main.accountId, accountType: main.type === 'Dr' ? 'debit' : 'credit',
        date: toDateString(voucher.date) ?? today(), narration: voucher.narration,
        lines: subLegs.map((leg) => ({ accountId: leg.accountId ?? 0, amount: Number(leg.amount), narration: leg.narration })),
      }} />
  </>;
}
