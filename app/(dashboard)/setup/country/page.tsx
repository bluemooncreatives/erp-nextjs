// Country - port of the matching Setup/Location controller.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { countryRepository } from '@/lib/setup/repositories';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { saveCountry, deleteCountry } from '../actions';
import { CountryFields } from './fields';

export const metadata: Metadata = { title: 'Country' };

export default async function CountryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('country.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await countryRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('country.index'),
    can('country.index'),
    can('country.index'),
  ]);

  return (
    <>
      <PageHeader title="Country" breadcrumb={[{ label: 'Setup' }, { label: 'Country' }]} />
      <ReferenceCrud
        title="Countries"
        singular="Country"
        extraColumns={['ISO2', 'Phone Code', 'Currency']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name ?? '',
          description: null,
          status: r.activeStatus,
          extra: [r.iso2 ?? '-', r.phonecode ?? '-', r.currency ?? '-'],
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['country.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={false}
        hasStatus={true}
        saveAction={saveCountry}
        deleteAction={deleteCountry}
      extraFields={() => <CountryFields />}
      />
    </>
  );
}
