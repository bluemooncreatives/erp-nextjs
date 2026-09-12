import { authorize } from '@/lib/auth/permissions';
import { incomeAccounts } from '@/lib/accounting/income';
import { PageHeader } from '@/components/erp/page';
import { IncomeForm } from '../form';
export default async function CreateIncomePage() {
  await authorize('income.store');
  const accounts = await incomeAccounts();
  return <><PageHeader title="Add Income" /><IncomeForm accounts={accounts.map((row) => ({ value: row.id, label: `${row.name} (${row.code})` }))} /></>;
}
