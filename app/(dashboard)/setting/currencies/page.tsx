// Currency - port of the matching Setup/Location controller.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { currencyRepository } from '@/lib/setup/repositories';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { saveCurrency, deleteCurrency } from '../../setup/actions';
import { CurrencyFields } from './fields';

export const metadata: Metadata = { title: 'Currency' };

export default async function CurrencyPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('currencies.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await currencyRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('currencies.store'),
    can('currencies.edit'),
    can('currencies.delete'),
  ]);

  const codeById = new Map(rows.map((r) => [r.id, r.code]));
  const symbolById = new Map(rows.map((r) => [r.id, r.symbol]));

  return (
    <>
      <PageHeader title="Currency" breadcrumb={[{ label: 'Settings' }, { label: 'Currencies' }]} />
      <ReferenceCrud
        title="Currencies"
        singular="Currency"
        extraColumns={['Code', 'Symbol']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name ?? '',
          description: null,
          status: null,
          extra: [r.code ?? '-', r.symbol ?? '-'],
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['currencies.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        hasDescription={false}
        hasStatus={false}
        saveAction={saveCurrency}
        deleteAction={deleteCurrency}
      extraFields={(row) => (
          <CurrencyFields
            defaultCode={row ? codeById.get(row.id) ?? '' : ''}
            defaultSymbol={row ? symbolById.get(row.id) ?? '' : ''}
          />
        )}
      />
    </>
  );
}
