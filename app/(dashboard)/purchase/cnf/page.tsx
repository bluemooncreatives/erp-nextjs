import { authorize, can } from '@/lib/auth/permissions';
import { cnfRepository } from '@/lib/purchase/cnf';
import { PageHeader } from '@/components/erp/page';
import { CnfList } from './list';

export default async function CnfPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  await authorize('cnf.index');
  const sp = await searchParams;
  const requested = Number(sp.page);
  const [result, canCreate, canEdit, canDelete] = await Promise.all([
    cnfRepository.list({ search: sp.search, page: Number.isSafeInteger(requested) && requested > 0 ? requested : 1 }),
    can('cnf.store'), can('cnf.edit'), can('cnf.delete'),
  ]);
  return <><PageHeader title="CNF Agents" /><CnfList {...result} search={sp.search} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} /></>;
}
