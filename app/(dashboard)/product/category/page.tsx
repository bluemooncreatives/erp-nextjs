// Port of Modules/Product/Http/Controllers/CategoryController.
//
// Categories are a two-level tree: a row with no `parent_id` is a category
// (level 0) and one with a parent is a sub-category (level 1).

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { categoriesWithParent, rootCategories } from '@/lib/product/repositories';
import { categoryRepository } from '@/lib/product/repositories';
import { PageHeader } from '@/components/erp/page';
import { ReferenceCrud } from '@/components/erp/reference-crud';
import { ROUTES } from '@/lib/routes';
import { deleteCategory, saveCategory } from '../actions';

export const metadata: Metadata = { title: 'Category' };

export default async function CategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await authorize('category.index');
  const sp = await searchParams;

  const { rows, total, page, perPage } = await categoryRepository.list({
    search: sp.search,
    page: Number(sp.page ?? 1),
  });

  const withParent = await categoriesWithParent();
  const parentById = new Map(withParent.map((c) => [c.id, c.parentName]));

  const parents = (await rootCategories()).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const [canCreate, canEdit, canDelete] = await Promise.all([
    can('category.store'),
    can('category.edit'),
    can('category.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Category"
        breadcrumb={[{ label: 'Products' }, { label: 'Category' }]}
      />
      <ReferenceCrud
        title="Categories"
        singular="Category"
        extraColumns={['Parent', 'Code']}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
          extra: [parentById.get(r.id) ?? '-', r.code ?? '-'],
        }))}
        total={total}
        page={page}
        perPage={perPage}
        baseUrl={ROUTES['category.index']}
        search={sp.search}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        saveAction={saveCategory}
        deleteAction={deleteCategory}
        extraFields={[
          {
            name: 'parent_id',
            label: 'Parent Category',
            kind: 'select',
            placeholder: 'None (top level)',
            options: parents,
            values: Object.fromEntries(
              withParent.map((c) => [String(c.id), c.parentId ? String(c.parentId) : '']),
            ),
          },
          {
            name: 'code',
            label: 'Code',
            values: Object.fromEntries(withParent.map((c) => [String(c.id), c.code ?? ''])),
          },
        ]}
      />
    </>
  );
}
