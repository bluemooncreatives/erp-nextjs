import { notFound } from 'next/navigation';
import { eq, isNull, or } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';
import { chartAccounts } from '@/lib/db/schema';
import { PageHeader } from '@/components/erp/page';
import { ChartAccountForm } from '../../../chart-account-form';

export default async function EditChartAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('char_accounts.edit');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [account] = await db.select().from(chartAccounts).where(eq(chartAccounts.id, id)).limit(1);
  if (!account) notFound();
  const parents = await db.select().from(chartAccounts).where(or(isNull(chartAccounts.parentId), eq(chartAccounts.isGroup, 1)));
  return <><PageHeader title={`Edit Account: ${account.name}`} /><ChartAccountForm account={account} parents={parents.filter((row) => row.id !== id).map((row) => ({ value: row.id, label: `${row.name} (${row.code})` }))} /></>;
}
