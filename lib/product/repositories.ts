// ---------------------------------------------------------------------------
// Product module reference data - ports of
//   Modules/Product/Repositories/{Brand,Category,ModelType,UnitType,Variant}Repository
// and Modules/Setup/Repositories for Tax and Department.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  brands,
  categories,
  departments,
  models,
  productSku,
  products,
  taxes,
  unitTypes,
  variantValues,
  variants,
  type BrandsRow,
  type CategoriesRow,
  type DepartmentsRow,
  type ModelsRow,
  type TaxesRow,
  type UnitTypesRow,
  type VariantValuesRow,
  type VariantsRow,
} from '@/lib/db/schema';
import { createReferenceRepository } from '@/lib/crud/reference-entity';

export const brandRepository = createReferenceRepository<BrandsRow>({
  table: brands,
  id: brands.id,
  searchable: [brands.name, brands.description],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

export const modelRepository = createReferenceRepository<ModelsRow>({
  table: models,
  id: models.id,
  searchable: [models.name, models.description],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

export const unitTypeRepository = createReferenceRepository<UnitTypesRow>({
  table: unitTypes,
  id: unitTypes.id,
  searchable: [unitTypes.name, unitTypes.description],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

export const variantRepository = createReferenceRepository<VariantsRow>({
  table: variants,
  id: variants.id,
  searchable: [variants.name, variants.description],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

export const categoryRepository = createReferenceRepository<CategoriesRow>({
  table: categories,
  id: categories.id,
  searchable: [categories.name, categories.description],
  audit: {
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
});

export const taxRepository = createReferenceRepository<TaxesRow>({
  table: taxes,
  id: taxes.id,
  searchable: [taxes.name, taxes.description],
  audit: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

export const departmentRepository = createReferenceRepository<DepartmentsRow>({
  table: departments,
  id: departments.id,
  searchable: [departments.name, departments.details],
  audit: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// ---------------------------------------------------------------------------
// Categories - the two-level parent/child tree the PHP kept with `level`.
// ---------------------------------------------------------------------------

/** `CategoryController@index` listed root categories (`parent_id` null). */
export async function rootCategories() {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.parentId))
    .orderBy(asc(categories.name));
}

/** `category_wise_subcategory` - the AJAX endpoint behind the sub-category select. */
export async function subCategories(parentId: number) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.parentId, parentId))
    .orderBy(asc(categories.name));
}

export type CategoryWithParent = CategoriesRow & { parentName: string | null };

export async function categoriesWithParent(): Promise<CategoryWithParent[]> {
  const parent = db.$with('parent').as(db.select().from(categories));
  void parent;

  const rows = await db
    .select({
      c: categories,
      parentName: sql<string | null>`(
        select p.name from categories p where p.id = ${categories.parentId}
      )`,
    })
    .from(categories)
    .orderBy(asc(categories.name));

  return rows.map((r) => ({ ...r.c, parentName: r.parentName }));
}

// ---------------------------------------------------------------------------
// Variants and their values
// ---------------------------------------------------------------------------

/** `variant_with_values` - a variant plus every value defined for it. */
export async function variantValuesFor(variantId: number): Promise<VariantValuesRow[]> {
  return db
    .select()
    .from(variantValues)
    .where(eq(variantValues.variantId, variantId))
    .orderBy(asc(variantValues.id));
}

export async function allVariantsWithValues() {
  const allVariants = await db.select().from(variants).orderBy(asc(variants.name));
  const allValues = await db.select().from(variantValues).orderBy(asc(variantValues.id));

  return allVariants.map((variant) => ({
    ...variant,
    values: allValues.filter((v) => v.variantId === variant.id),
  }));
}

/** `VariantRepository::create()` also wrote the submitted values. */
export async function createVariantWithValues(
  data: { name: string; description?: string | null; status: number },
  values: string[],
  userId?: number | null,
) {
  const variantId = await variantRepository.create(data, userId);

  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (clean.length) {
    await db.insert(variantValues).values(
      clean.map((value) => ({
        value,
        variantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }
  return variantId;
}

export async function updateVariantWithValues(
  id: number,
  data: { name: string; description?: string | null; status: number },
  values: string[],
  userId?: number | null,
) {
  await variantRepository.update(id, data, userId);

  const existing = await variantValuesFor(id);
  const clean = values.map((v) => v.trim()).filter(Boolean);

  // Values already used by a product variation must not be removed - the PHP
  // guarded this with the `used` flag.
  const removable = existing.filter((e) => e.used !== 1 && !clean.includes(e.value));
  for (const row of removable) {
    await db.delete(variantValues).where(eq(variantValues.id, row.id));
  }

  const existingValues = new Set(existing.map((e) => e.value));
  const toAdd = clean.filter((v) => !existingValues.has(v));
  if (toAdd.length) {
    await db.insert(variantValues).values(
      toAdd.map((value) => ({
        value,
        variantId: id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }
}

// ---------------------------------------------------------------------------
// Usage guards - the PHP refused to delete reference data still in use.
// ---------------------------------------------------------------------------

async function countProductsWhere(condition: ReturnType<typeof eq>): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(condition);
  return Number(row?.count ?? 0);
}

export const brandInUse = (id: number) => countProductsWhere(eq(products.brandId, id));
export const modelInUse = (id: number) => countProductsWhere(eq(products.modelId, id));
export const unitTypeInUse = (id: number) =>
  countProductsWhere(eq(products.unitTypeId, id));
export const categoryInUse = (id: number) =>
  countProductsWhere(eq(products.categoryId, id));

export async function variantInUse(id: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(variantValues)
    .where(and(eq(variantValues.variantId, id), eq(variantValues.used, 1)));
  return Number(row?.count ?? 0);
}

/** Dropdown options shared by the product form and the document forms. */
export async function productFormOptions() {
  const [brandRows, modelRows, unitRows, categoryRows, taxRows] = await Promise.all([
    db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, 1)),
    db.select({ id: models.id, name: models.name }).from(models).where(eq(models.status, 1)),
    db
      .select({ id: unitTypes.id, name: unitTypes.name })
      .from(unitTypes)
      .where(eq(unitTypes.status, 1)),
    db
      .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.status, 1)),
    db.select({ id: taxes.id, name: taxes.name, rate: taxes.rate }).from(taxes).where(eq(taxes.status, 1)),
  ]);

  return {
    brands: brandRows,
    models: modelRows,
    unitTypes: unitRows,
    categories: categoryRows.filter((c) => c.parentId == null),
    subCategories: categoryRows.filter((c) => c.parentId != null),
    taxes: taxRows,
  };
}

/** Count of SKUs per product, for the product list screen. */
export async function skuCounts(productIds: number[]): Promise<Map<number, number>> {
  if (!productIds.length) return new Map();
  const rows = await db
    .select({
      productId: productSku.productId,
      count: sql<number>`count(*)`,
    })
    .from(productSku)
    .groupBy(productSku.productId);

  return new Map(
    rows
      .filter((r) => r.productId != null)
      .map((r) => [r.productId as number, Number(r.count)]),
  );
}
