import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { receiveByAccounts, receiveFromAccounts } from '@/lib/accounting/accounts';
import { today } from '@/lib/php-date';
import { PageHeader } from '@/components/erp/page';
import { ReceiptVoucherForm } from '../recieve/form';

export const metadata: Metadata = { title: 'Add Receipt Voucher' };

export default async function CreateReceiptPage() {
  await authorize('voucher_recieve.store');
  const [from, by] = await Promise.all([receiveFromAccounts(), receiveByAccounts()]);
  return <>
    <PageHeader title="Add Receipt Voucher" breadcrumb={[{ label: 'Accounts' }, { label: 'Receipt Voucher' }]} />
    <ReceiptVoucherForm defaults={{ date: today() }}
      fromAccounts={from.map((account) => ({ value: account.id, label: `${account.name} (${account.code})` }))}
      byAccounts={by.map((account) => ({ value: account.id, label: `${account.name} (${account.code})`, group: account.configurationGroupId }))} />
  </>;
}
