// Intro Prefix - port of the matching Setup/Location controller.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { introPrefixRepository } from '@/lib/setup/repositories';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { saveIntroPrefix, deleteIntroPrefix } from '../actions';

export const metadata: Metadata = { title: 'Intro Prefix' };

export default async function PrefixPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('introPrefix.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await introPrefixRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('introPrefix.store'),
    can('introPrefix.edit'),
    can('introPrefix.destroy'),
  ]);

  return (
    <>
      <PageHeader title="Intro Prefix" breadcrumb={[{ label: 'Setup' }, { label: 'Intro Prefix' }]} />
      <ReferenceCrud
        title="Prefixes"
        singular="Prefix"
        extraColumns={[]}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.prefix,
          description: r.title,
          status: null,
          extra: undefined,
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['introPrefix.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={true}
        hasStatus={false}
        saveAction={saveIntroPrefix}
        deleteAction={deleteIntroPrefix}

      />
    </>
  );
}
