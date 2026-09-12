import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findBankAccount } from '@/lib/accounting/expenses';
import { PageHeader } from '@/components/erp/page';
import { BankAccountForm } from '../../bank-account-form';
export default async function EditBankAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('bank_accounts.edit');
  const id = Number((await params).id);
  const account = Number.isSafeInteger(id) && id > 0 ? await findBankAccount(id) : null;
  if (!account) notFound();
  return <><PageHeader title="Edit Bank Account" /><BankAccountForm account={account} /></>;
}
