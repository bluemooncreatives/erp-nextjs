// Branch - port of the matching Setup/Location controller.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { showRoomRepository } from '@/lib/setup/repositories';
import { ROUTES, route } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { saveShowRoom, deleteShowRoom } from '../../setup/actions';
import { ContactFields } from './fields';

export const metadata: Metadata = { title: 'Branch' };

export default async function BranchPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('showroom.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await showRoomRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('showroom.store'),
    can('showroom.edit'),
    can('showroom.destroy'),
  ]);

  return (
    <>
      <PageHeader title="Branch" breadcrumb={[{ label: 'Location' }, { label: 'Branch' }]} />
      <ReferenceCrud
        title="Branches"
        singular="Branch"
        extraColumns={['Email', 'Phone']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: null,
          status: r.status,
          extra: [r.email ?? '-', r.phone ?? '-'],
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['showroom.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={false}
        hasStatus={true}
        detailHref={(row) => route('showroom.show', { id: row.id })}
        saveAction={saveShowRoom}
        deleteAction={deleteShowRoom}
      extraFields={() => <ContactFields />}
      />
    </>
  );
}
