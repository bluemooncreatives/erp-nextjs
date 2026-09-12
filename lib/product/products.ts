// ---------------------------------------------------------------------------
// Products, SKUs, variations and combos.
// Port of Modules/Product/Repositories/ProductRepository.php.
//
// A product has one of four `product_type` values:
//   Single    - one SKU
//   Variable  - one SKU per variant combination, joined by `product_variations`
//   Service   - one SKU, priced by `hourly_rate`, never stock-tracked
//   Combo     - a `combo_products` row bundling other SKUs (not a `products` row)
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, inArray, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  brands,
  categories,
  comboProductDetails,
  comboProducts,
  models,
  productSku,
  productVariations,
  products,
  showRooms,
  stockReports,
  unitTypes,
  variantValues,
  variants,
  wareHouses,
  type ProductSkuRow,
  type ProductsRow,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { deleteStoredFile } from '@/lib/uploads';

export { ProductType, type ProductTypeValue } from './constants';
import { ProductType } from './constants';
import type { ProductTypeValue } from './constants';

/** PHP's `Str::random($n)` over the alphanumeric alphabet. */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export type ProductListRow = ProductSkuRow & {
  productName: string | null;
  productType: string | null;
  categoryName: string | null;
  brandName: string | null;
  unitTypeName: string | null;
  modelName: string | null;
  imageSource: string | null;
};

export type ProductListFilters = {
  search?: string;
  /** 'Service' lists services; anything else excludes them, as the PHP did. */
  serviceOnly?: boolean;
  brandId?: number;
  categoryId?: number;
  page?: number;
  perPage?: number;
};

/** `all()` (non-service SKUs) and `service()` (service SKUs). */
export async function listProductSkus(
  filters: ProductListFilters = {},
): Promise<{ rows: ProductListRow[]; total: number; page: number; perPage: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [
    filters.serviceOnly
      ? eq(products.productType, ProductType.Service)
      : ne(products.productType, ProductType.Service),
  ];

  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      or(
        like(products.productName, term),
        like(products.productType, term),
        like(productSku.sku, term),
      )!,
    );
  }
  if (filters.brandId) where.push(eq(products.brandId, filters.brandId));
  if (filters.categoryId) where.push(eq(products.categoryId, filters.categoryId));

  const condition = and(...where);

  const rows = await db
    .select({
      sku: productSku,
      productName: products.productName,
      productType: products.productType,
      imageSource: products.imageSource,
      categoryName: categories.name,
      brandName: brands.name,
      unitTypeName: unitTypes.name,
      modelName: models.name,
    })
    .from(productSku)
    .innerJoin(products, eq(products.id, productSku.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(unitTypes, eq(unitTypes.id, products.unitTypeId))
    .leftJoin(models, eq(models.id, products.modelId))
    .where(condition)
    .orderBy(desc(productSku.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productSku)
    .innerJoin(products, eq(products.id, productSku.productId))
    .where(condition);

  return {
    rows: rows.map((r) => ({
      ...r.sku,
      productName: r.productName,
      productType: r.productType,
      imageSource: r.imageSource,
      categoryName: r.categoryName,
      brandName: r.brandName,
      unitTypeName: r.unitTypeName,
      modelName: r.modelName,
    })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

/** `find($id)` with the relations the edit screen needs. */
export async function findProduct(id: number) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) return null;

  const skus = await db
    .select()
    .from(productSku)
    .where(eq(productSku.productId, id))
    .orderBy(productSku.id);

  const variationRows = await db
    .select()
    .from(productVariations)
    .where(eq(productVariations.productId, id));

  return { product: row, skus, variations: variationRows };
}

export async function findProductSku(id: number): Promise<ProductSkuRow | null> {
  const [row] = await db.select().from(productSku).where(eq(productSku.id, id)).limit(1);
  return row ?? null;
}

/** `allStockProduct()` - products with stock somewhere, for the sale/quote forms. */
export async function productsWithStock(locationId?: number, locationType?: string) {
  const conditions: SQL[] = [ne(products.productType, ProductType.Service)];
  if (locationId != null && locationType) {
    conditions.push(eq(stockReports.houseableId, locationId));
    conditions.push(eq(stockReports.houseableType, locationType));
  }
  conditions.push(sql`cast(${stockReports.stock} as decimal(20,2)) > 0`);

  return db
    .selectDistinct({
      id: productSku.id,
      sku: productSku.sku,
      productId: products.id,
      productName: products.productName,
      sellingPrice: productSku.sellingPrice,
      minSellingPrice: productSku.minSellingPrice,
      purchasePrice: productSku.purchasePrice,
      tax: productSku.tax,
      stock: stockReports.stock,
    })
    .from(productSku)
    .innerJoin(products, eq(products.id, productSku.productId))
    .innerJoin(stockReports, eq(stockReports.productSkuId, productSku.id))
    .where(and(...conditions))
    .orderBy(products.productName);
}

/** `productForPurchase()` - every stockable SKU, whether or not it has stock. */
export async function productsForPurchase() {
  return db
    .select({
      id: productSku.id,
      sku: productSku.sku,
      productId: products.id,
      productName: products.productName,
      purchasePrice: productSku.purchasePrice,
      sellingPrice: productSku.sellingPrice,
      tax: productSku.tax,
    })
    .from(productSku)
    .innerJoin(products, eq(products.id, productSku.productId))
    .where(ne(products.productType, ProductType.Service))
    .orderBy(products.productName);
}

/** `searchProduct()` - exact name or SKU, used by the barcode scanner field. */
export async function searchProductByCode(term: string) {
  return db
    .select({
      id: productSku.id,
      sku: productSku.sku,
      barcodeId: productSku.barcodeId,
      productName: products.productName,
      sellingPrice: productSku.sellingPrice,
      tax: productSku.tax,
    })
    .from(productSku)
    .innerJoin(products, eq(products.id, productSku.productId))
    .where(
      or(
        eq(productSku.sku, term),
        eq(productSku.barcodeId, term),
        eq(products.productName, term),
      ),
    )
    .limit(25);
}

// ---------------------------------------------------------------------------
// Combos
// ---------------------------------------------------------------------------

export async function listComboProducts(search?: string) {
  const where = search
    ? or(like(comboProducts.name, `%${search}%`), like(comboProducts.barcodeType, `%${search}%`))
    : undefined;

  return db.select().from(comboProducts).where(where).orderBy(desc(comboProducts.id));
}

export async function findComboProduct(id: number) {
  const [combo] = await db
    .select()
    .from(comboProducts)
    .where(eq(comboProducts.id, id))
    .limit(1);
  if (!combo) return null;

  const details = await db
    .select({
      detail: comboProductDetails,
      sku: productSku.sku,
      sellingPrice: productSku.sellingPrice,
      tax: productSku.tax,
      productName: products.productName,
      imageSource: products.imageSource,
      categoryName: categories.name,
      brandName: brands.name,
    })
    .from(comboProductDetails)
    .leftJoin(productSku, eq(productSku.id, comboProductDetails.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(eq(comboProductDetails.comboProductId, id));

  return { combo, details };
}

/** `comboStatus()` - the active toggle on the combo tab of the product list. */
export async function setComboStatus(id: number, status: number): Promise<void> {
  await db.update(comboProducts).set({ status }).where(eq(comboProducts.id, id));
}

/**
 * `product_Detail()` for a non-combo product: the product with its SKUs, the
 * variant rows, and the stock held at each branch or warehouse. The Blade also
 * printed the category, brand and unit names, which are joined here.
 */
export async function productDetail(id: number) {
  const [row] = await db
    .select({
      product: products,
      categoryName: categories.name,
      brandName: brands.name,
      unitTypeName: unitTypes.name,
      modelName: models.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(unitTypes, eq(unitTypes.id, products.unitTypeId))
    .leftJoin(models, eq(models.id, products.modelId))
    .where(eq(products.id, id))
    .limit(1);
  if (!row) return null;

  const skus = await db
    .select()
    .from(productSku)
    .where(eq(productSku.productId, id))
    .orderBy(productSku.id);

  const skuIds = skus.map((s) => s.id);

  const variationRows = skuIds.length
    ? await db
        .select({
          variation: productVariations,
          sku: productSku,
        })
        .from(productVariations)
        .leftJoin(productSku, eq(productSku.id, productVariations.productSkuId))
        .where(eq(productVariations.productId, id))
    : [];

  const stocks = skuIds.length
    ? await db
        .select({
          productSkuId: stockReports.productSkuId,
          stock: stockReports.stock,
          houseableId: stockReports.houseableId,
          houseableType: stockReports.houseableType,
          showroomName: showRooms.name,
          warehouseName: wareHouses.name,
        })
        .from(stockReports)
        .leftJoin(
          showRooms,
          and(
            eq(showRooms.id, stockReports.houseableId),
            eq(stockReports.houseableType, MorphType.ShowRoom),
          ),
        )
        .leftJoin(
          wareHouses,
          and(
            eq(wareHouses.id, stockReports.houseableId),
            eq(stockReports.houseableType, MorphType.WareHouse),
          ),
        )
        .where(inArray(stockReports.productSkuId, skuIds))
    : [];

  return { ...row, skus, variations: variationRows, stocks };
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

export type ProductInput = {
  productName: string;
  productType: ProductTypeValue;
  modelId?: number | null;
  unitTypeId?: number | null;
  brandId?: number | null;
  categoryId?: number | null;
  subCategoryId?: number | null;
  origin?: string | null;
  description?: string | null;
  imageSource?: string | null;
  barcodeType?: string | null;
  manageStock?: number;
  alertQuantity?: string | null;

  /** Single / Service SKU fields. */
  productSkuCode?: string | null;
  purchasePrice?: number;
  sellingPrice?: number;
  minSellingPrice?: number;
  hourlyRate?: number;
  tax?: number;
  taxType?: string | null;

  /** Variable-product rows, one per variant combination. */
  variations?: Array<{
    productSkuId?: number | null;
    sku?: string | null;
    variantIds: number[];
    variantValueIds: number[];
    purchasePrice: number;
    sellingPrice: number;
    minSellingPrice: number;
    alertQuantity: number;
    imageSource?: string | null;
  }>;
};

/** Build the SKU string the way the PHP did when none was supplied. */
function defaultSkuFrom(name: string): string {
  return name.length <= 10 ? name : name.slice(0, 9);
}

/** `ProductRepository::create($data)` for Single / Variable / Service. */
export async function createProduct(
  data: ProductInput,
  userId?: number | null,
): Promise<number> {
  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(products).values({
      productName: data.productName,
      productType: data.productType,
      modelId: data.modelId ?? null,
      unitTypeId: data.unitTypeId ?? null,
      brandId: data.brandId ?? null,
      categoryId: data.categoryId ?? null,
      subCategoryId: data.subCategoryId ?? null,
      origin: data.origin ?? null,
      description: data.description ?? null,
      imageSource: data.imageSource ?? null,
      barcodeType: data.barcodeType ?? null,
      manageStock: data.manageStock ?? 0,
      alertQuantity: data.alertQuantity ?? null,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const productId = Number(inserted.insertId);

    if (data.productType === ProductType.Variable) {
      for (const variation of data.variations ?? []) {
        const base = variation.sku?.trim() || defaultSkuFrom(data.productName);

        // The PHP appended a random suffix when the SKU already existed.
        const [clash] = await tx
          .select({ id: productSku.id })
          .from(productSku)
          .where(eq(productSku.sku, base))
          .limit(1);
        const sku = clash ? `${base}${randomString(6)}` : base;

        const [skuRow] = await tx.insert(productSku).values({
          productId,
          sku,
          costOfGoods: variation.purchasePrice,
          alertQuantity: variation.alertQuantity,
          purchasePrice: variation.purchasePrice,
          minSellingPrice: variation.minSellingPrice,
          sellingPrice: variation.sellingPrice,
          tax: data.tax ?? 0,
          taxType: 'percent',
          barcodeId: `1000-${productId}-${randomString(12)}`,
          barcodeType: data.barcodeType ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await tx.insert(productVariations).values({
          productId,
          variantId: JSON.stringify(variation.variantIds),
          productSkuId: Number(skuRow.insertId),
          variantValueId: JSON.stringify(variation.variantValueIds),
          imageSource: variation.imageSource ?? null,
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          createdAt: new Date(),
        });

        // Mark the chosen values as used so they cannot be deleted.
        if (variation.variantValueIds.length) {
          await tx
            .update(variantValues)
            .set({ used: 1 })
            .where(
              and(
                inArray(variantValues.id, variation.variantValueIds),
                eq(variantValues.used, 0),
              ),
            );
        }
      }
      return productId;
    }

    // Single / Service - one SKU. A service is priced by its hourly rate.
    const sellingPrice =
      data.productType === ProductType.Service
        ? (data.hourlyRate ?? 0)
        : (data.sellingPrice ?? 0);

    const [skuRow] = await tx.insert(productSku).values({
      productId,
      costOfGoods: data.purchasePrice ?? 0,
      alertQuantity: Number(data.alertQuantity ?? 0),
      purchasePrice: data.purchasePrice ?? 0,
      sellingPrice,
      minSellingPrice: data.minSellingPrice ?? 0,
      tax: data.tax ?? 0,
      taxType: data.taxType ?? 'percent',
      barcodeId: `1000-${productId}-${randomString(12)}`,
      barcodeType: data.barcodeType ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // The PHP re-saved the SKU as `<base>-<id>` once the id was known.
    const base = data.productSkuCode?.trim() || defaultSkuFrom(data.productName);
    await tx
      .update(productSku)
      .set({ sku: `${base}-${Number(skuRow.insertId)}` })
      .where(eq(productSku.id, Number(skuRow.insertId)));

    return productId;
  });
}

/** `ProductRepository::update($data, $id)`. */
export async function updateProduct(
  id: number,
  data: ProductInput,
  userId?: number | null,
): Promise<void> {
  await runInTransaction(async (tx) => {
    const updates: Record<string, unknown> = {
      productName: data.productName,
      productType: data.productType,
      modelId: data.modelId ?? null,
      unitTypeId: data.unitTypeId ?? null,
      brandId: data.brandId ?? null,
      categoryId: data.categoryId ?? null,
      subCategoryId: data.subCategoryId ?? null,
      origin: data.origin ?? null,
      description: data.description ?? null,
      barcodeType: data.barcodeType ?? null,
      manageStock: data.manageStock ?? 0,
      alertQuantity: data.alertQuantity ?? null,
      updatedBy: userId ?? null,
      updatedAt: new Date(),
    };
    // Only overwrite the image when a new one was uploaded.
    if (data.imageSource) updates.imageSource = data.imageSource;

    await tx.update(products).set(updates).where(eq(products.id, id));

    if (data.productType === ProductType.Variable) {
      // The PHP dropped and rebuilt the variation rows on every update.
      await tx.delete(productVariations).where(eq(productVariations.productId, id));

      for (const variation of data.variations ?? []) {
        let skuId = variation.productSkuId ?? null;

        const values = {
          productId: id,
          sku: variation.sku ?? defaultSkuFrom(data.productName),
          costOfGoods: variation.purchasePrice,
          alertQuantity: variation.alertQuantity,
          purchasePrice: variation.purchasePrice,
          sellingPrice: variation.sellingPrice,
          minSellingPrice: variation.minSellingPrice,
          tax: data.tax ?? 0,
          taxType: 'percent',
          barcodeType: data.barcodeType ?? null,
          updatedAt: new Date(),
        };

        if (skuId) {
          await tx.update(productSku).set(values).where(eq(productSku.id, skuId));
        } else {
          const [row] = await tx.insert(productSku).values({
            ...values,
            barcodeId: `1000-${id}-${randomString(12)}`,
            createdAt: new Date(),
          });
          skuId = Number(row.insertId);
        }

        await tx.insert(productVariations).values({
          productId: id,
          variantId: JSON.stringify(variation.variantIds),
          productSkuId: skuId,
          variantValueId: JSON.stringify(variation.variantValueIds),
          imageSource: variation.imageSource ?? null,
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          createdAt: new Date(),
        });

        if (variation.variantValueIds.length) {
          await tx
            .update(variantValues)
            .set({ used: 1 })
            .where(
              and(
                inArray(variantValues.id, variation.variantValueIds),
                eq(variantValues.used, 0),
              ),
            );
        }
      }
      return;
    }

    // Single / Service - update the product's one SKU.
    const [existing] = await tx
      .select()
      .from(productSku)
      .where(eq(productSku.productId, id))
      .limit(1);
    if (!existing) return;

    const sellingPrice =
      data.productType === ProductType.Service
        ? (data.hourlyRate ?? 0)
        : (data.sellingPrice ?? 0);

    const values: Record<string, unknown> = {
      tax: data.tax ?? 0,
      taxType: data.taxType ?? 'percent',
      barcodeType: data.barcodeType ?? null,
      updatedAt: new Date(),
    };

    // The PHP only rewrote prices when a SKU code was posted.
    if (data.productSkuCode) {
      values.sku = data.productSkuCode;
      values.costOfGoods = data.purchasePrice ?? 0;
      values.alertQuantity = Number(data.alertQuantity ?? 0);
      values.purchasePrice = data.purchasePrice ?? 0;
      values.sellingPrice = sellingPrice;
      values.minSellingPrice = data.minSellingPrice ?? 0;
    }

    await tx.update(productSku).set(values).where(eq(productSku.id, existing.id));
  });
}

/** `ProductRepository::delete($id)` - removes SKUs, combo links and images. */
export async function deleteProduct(id: number): Promise<void> {
  const found = await findProduct(id);
  if (!found) return;

  await runInTransaction(async (tx) => {
    const skuIds = found.skus.map((s) => s.id);
    if (skuIds.length) {
      await tx
        .delete(comboProductDetails)
        .where(inArray(comboProductDetails.productSkuId, skuIds));
    }
    await tx.delete(productVariations).where(eq(productVariations.productId, id));
    await tx.delete(productSku).where(eq(productSku.productId, id));
    await tx.delete(products).where(eq(products.id, id));
  });

  await deleteStoredFile(found.product.imageSource);
  for (const variation of found.variations) {
    await deleteStoredFile(variation.imageSource);
  }
}

/** `deleteCombo($id)` */
export async function deleteComboProduct(id: number): Promise<void> {
  const found = await findComboProduct(id);
  if (!found) return;

  await runInTransaction(async (tx) => {
    await tx
      .delete(comboProductDetails)
      .where(eq(comboProductDetails.comboProductId, id));
    await tx.delete(comboProducts).where(eq(comboProducts.id, id));
  });

  await deleteStoredFile(found.combo.imageSource);
}

/** `create()` for a Combo product. */
export async function createComboProduct(
  data: {
    name: string;
    showroomId: number;
    barcodeType?: string | null;
    price: number;
    totalPurchasePrice: number;
    totalRegularPrice: number;
    minSellingPrice: number;
    description?: string | null;
    imageSource?: string | null;
  },
  items: Array<{ productSkuId: number; quantity: number }>,
  userId?: number | null,
): Promise<number> {
  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(comboProducts).values({
      name: data.name,
      showroomId: data.showroomId,
      barcodeId: `2000-${randomString(12)}`,
      barcodeType: data.barcodeType ?? null,
      price: data.price,
      totalPurchasePrice: data.totalPurchasePrice,
      totalRegularPrice: data.totalRegularPrice,
      minSellingPrice: data.minSellingPrice,
      description: data.description ?? null,
      imageSource: data.imageSource ?? null,
      status: 1,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const comboId = Number(inserted.insertId);

    for (const item of items) {
      await tx.insert(comboProductDetails).values({
        comboProductId: comboId,
        productSkuId: item.productSkuId,
        productQty: item.quantity,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return comboId;
  });
}

/** `update()` for a Combo product. */
export async function updateComboProduct(
  id: number,
  data: {
    name: string;
    barcodeType?: string | null;
    price: number;
    totalPurchasePrice: number;
    totalRegularPrice: number;
    minSellingPrice: number;
    description?: string | null;
    imageSource?: string | null;
  },
  items: Array<{ productSkuId: number; quantity: number }>,
  userId?: number | null,
): Promise<void> {
  await runInTransaction(async (tx) => {
    const updates: Record<string, unknown> = {
      name: data.name,
      barcodeType: data.barcodeType ?? null,
      price: data.price,
      totalPurchasePrice: data.totalPurchasePrice,
      totalRegularPrice: data.totalRegularPrice,
      minSellingPrice: data.minSellingPrice,
      description: data.description ?? null,
      updatedBy: userId ?? null,
      updatedAt: new Date(),
    };
    if (data.imageSource) updates.imageSource = data.imageSource;

    await tx.update(comboProducts).set(updates).where(eq(comboProducts.id, id));

    // Replace the bundle contents with what was submitted.
    await tx
      .delete(comboProductDetails)
      .where(eq(comboProductDetails.comboProductId, id));

    for (const item of items) {
      await tx.insert(comboProductDetails).values({
        comboProductId: id,
        productSkuId: item.productSkuId,
        productQty: item.quantity,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });
}

/**
 * `variantNameFromSku($productSku)` from Helper.php - "Colour : Red ; Size : L ; "
 */
export async function variantNameForSku(productSkuId: number): Promise<string | null> {
  const [variation] = await db
    .select()
    .from(productVariations)
    .where(eq(productVariations.productSkuId, productSkuId))
    .limit(1);
  if (!variation) return null;

  const variantIds = parseJsonIds(variation.variantId);
  const valueIds = parseJsonIds(variation.variantValueId);
  if (!variantIds.length) return null;

  const [variantRows, valueRows] = await Promise.all([
    db.select().from(variants).where(inArray(variants.id, variantIds)),
    valueIds.length
      ? db.select().from(variantValues).where(inArray(variantValues.id, valueIds))
      : Promise.resolve([]),
  ]);

  const variantById = new Map(variantRows.map((v) => [v.id, v.name]));
  const valueById = new Map(valueRows.map((v) => [v.id, v.value]));

  let out = '';
  for (let i = 0; i < variantIds.length; i++) {
    const name = variantById.get(variantIds[i]);
    const value = valueById.get(valueIds[i]);
    if (name && value) out += `${name} : ${value} ; `;
  }
  return out || null;
}

function parseJsonIds(value: unknown): number[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

/** Stock held for a SKU across every location. */
export async function skuStockTotal(productSkuId: number): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(cast(${stockReports.stock} as decimal(20,2))), 0)`,
    })
    .from(stockReports)
    .where(eq(stockReports.productSkuId, productSkuId));
  return Number(row?.total ?? 0);
}

/** Stock per SKU at one location, for the listing screens. */
export async function skuStockAt(
  productSkuIds: number[],
  locationId: number,
  locationType: string = MorphType.ShowRoom,
): Promise<Map<number, number>> {
  if (!productSkuIds.length) return new Map();
  const rows = await db
    .select({ productSkuId: stockReports.productSkuId, stock: stockReports.stock })
    .from(stockReports)
    .where(
      and(
        inArray(stockReports.productSkuId, productSkuIds),
        eq(stockReports.houseableId, locationId),
        eq(stockReports.houseableType, locationType),
      ),
    );
  return new Map(rows.map((r) => [r.productSkuId, Number(r.stock) || 0]));
}

export type { ProductsRow };
