// ---------------------------------------------------------------------------
// Stock - `stock_reports` (current on-hand) and `product_histories` (movement).
//
// Two polymorphic columns with confusingly similar names, both carried over
// verbatim from the PHP schema:
//
//   stock_reports.houseable_*    -> the LOCATION (ShowRoom or WareHouse)
//   product_histories.houseable_*-> the DOCUMENT (Sale, PurchaseOrder, ...)
//   product_histories.itemable_* -> the LOCATION (ShowRoom or WareHouse)
//
// `stock_reports.stock` is a VARCHAR in the original schema, so every read is
// parsed and every write is stringified to keep the column format identical.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { productHistories, stockReports } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { today } from '@/lib/php-date';

type Tx = MySql2Database<typeof schema>;

/** A stock location: a branch (ShowRoom) or a WareHouse. */
export type StockLocation = {
  id: number;
  type: typeof MorphType.ShowRoom | typeof MorphType.WareHouse;
};

/**
 * The UI posts the location as `"warehouse-3"` or `"showroom-1"`, which the PHP
 * split with `explode('-', $data['warehouse_id'])`.
 */
export function parseLocation(value: string): StockLocation | null {
  const [kind, rawId] = String(value).split('-');
  const id = Number(rawId);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    type: kind === 'warehouse' ? MorphType.WareHouse : MorphType.ShowRoom,
  };
}

export function formatLocation(location: StockLocation): string {
  return `${location.type === MorphType.WareHouse ? 'warehouse' : 'showroom'}-${location.id}`;
}

/** `stock_reports.stock` is stored as text; normalise on read. */
export function stockValue(raw: string | number | null | undefined): number {
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : (raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** `$w->stocks()->where('product_sku_id', $id)->first()` */
export async function findStock(
  location: StockLocation,
  productSkuId: number,
  conn: Tx = db,
) {
  const [row] = await conn
    .select()
    .from(stockReports)
    .where(
      and(
        eq(stockReports.houseableId, location.id),
        eq(stockReports.houseableType, location.type),
        eq(stockReports.productSkuId, productSkuId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function currentStock(
  location: StockLocation,
  productSkuId: number,
  conn: Tx = db,
): Promise<number> {
  const row = await findStock(location, productSkuId, conn);
  return row ? stockValue(row.stock) : 0;
}

/**
 * Serializes writers at one location behind its `stock_reports` rows, inside
 * an open transaction. The PHP had no such lock either - stock could already
 * be oversold by two concurrent regular sales there - but this port added one
 * to POS's checkout only; a POS sale and a regular sale (or two regular
 * sales) racing the same location still had the plain read-then-write TOCTOU
 * gap. Call this once, right after opening the transaction and before any
 * `currentStock()` check, everywhere a sale/purchase/transfer/adjustment
 * writes stock at a location.
 */
export async function lockLocationStock(location: StockLocation, tx: Tx): Promise<void> {
  await tx
    .select({ id: stockReports.id })
    .from(stockReports)
    .where(and(eq(stockReports.houseableId, location.id), eq(stockReports.houseableType, location.type)))
    .for('update');
}

/** On-hand for many SKUs at one location, in a single query. */
export async function stockLevels(
  location: StockLocation,
  productSkuIds: number[],
  conn: Tx = db,
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!productSkuIds.length) return out;

  const rows = await conn
    .select({ productSkuId: stockReports.productSkuId, stock: stockReports.stock })
    .from(stockReports)
    .where(
      and(
        eq(stockReports.houseableId, location.id),
        eq(stockReports.houseableType, location.type),
        inArray(stockReports.productSkuId, productSkuIds),
      ),
    );

  for (const row of rows) out.set(row.productSkuId, stockValue(row.stock));
  return out;
}

/**
 * Set the on-hand figure, creating the row when the location has never held
 * the SKU. The PHP code called `$stock->update(['stock' => ...])`.
 */
export async function setStock(
  location: StockLocation,
  productSkuId: number,
  value: number,
  conn: Tx = db,
): Promise<void> {
  const existing = await findStock(location, productSkuId, conn);

  if (existing) {
    await conn
      .update(stockReports)
      .set({ stock: String(value), updatedAt: new Date() })
      .where(eq(stockReports.id, existing.id));
    return;
  }

  await conn.insert(stockReports).values({
    houseableId: location.id,
    houseableType: location.type,
    productSkuId,
    stock: String(value),
    stockDate: today(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** Add to (positive) or take from (negative) the on-hand figure. */
export async function adjustStock(
  location: StockLocation,
  productSkuId: number,
  delta: number,
  conn: Tx = db,
): Promise<number> {
  const current = await currentStock(location, productSkuId, conn);
  const next = current + delta;
  await setStock(location, productSkuId, next, conn);
  return next;
}

// ---------------------------------------------------------------------------
// Movement history
// ---------------------------------------------------------------------------

/** `product_histories.type` values written by the PHP repositories. */
export const MovementType = {
  Sales: 'sales',
  SalesReturn: 'sales_return',
  Purchase: 'purchase',
  PurchaseReturn: 'purchase_return',
  OpeningStock: 'opening_stock',
  StockTransfer: 'stock_transfer',
  StockAdjustment: 'stock_adjustment',
  Quotation: 'quotation',
} as const;

export type MovementTypeValue = (typeof MovementType)[keyof typeof MovementType];

/**
 * `$document->houses()->save(new ProductHistory([...]))`
 *
 * `houseable` is the document that caused the movement; `itemable` is the
 * location the stock moved at.
 */
export async function recordMovement(
  options: {
    type: MovementTypeValue;
    documentType: string;
    documentId: number;
    location: StockLocation;
    productSkuId: number;
    quantity: number;
    date?: string;
    status?: number;
    userId?: number | null;
  },
  conn: Tx = db,
): Promise<number> {
  const [row] = await conn.insert(productHistories).values({
    type: options.type,
    houseableId: options.documentId,
    houseableType: options.documentType,
    itemableId: options.location.id,
    itemableType: options.location.type,
    date: options.date ?? today(),
    inOut: options.quantity,
    productSkuId: options.productSkuId,
    status: options.status ?? 0,
    createdBy: options.userId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Number(row.insertId);
}

/** Movement rows raised by one document. */
export async function movementsFor(
  documentType: string,
  documentId: number,
  conn: Tx = db,
) {
  return conn
    .select()
    .from(productHistories)
    .where(
      and(
        eq(productHistories.houseableType, documentType),
        eq(productHistories.houseableId, documentId),
      ),
    );
}

/** Drop a document's movement rows - `foreach ($sale->houses as $h) $h->delete()`. */
export async function deleteMovementsFor(
  documentType: string,
  documentId: number,
  conn: Tx = db,
): Promise<void> {
  await conn
    .delete(productHistories)
    .where(
      and(
        eq(productHistories.houseableType, documentType),
        eq(productHistories.houseableId, documentId),
      ),
    );
}

/** Every stock row at a location, newest first - the Stock List screen. */
export async function stockAtLocation(location: StockLocation) {
  return db
    .select()
    .from(stockReports)
    .where(
      and(
        eq(stockReports.houseableId, location.id),
        eq(stockReports.houseableType, location.type),
      ),
    )
    .orderBy(desc(stockReports.id));
}

/** `getTotalStockAttribute()` - a location's total units on hand. */
export async function totalStockAt(location: StockLocation): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(cast(${stockReports.stock} as decimal(20,2))), 0)` })
    .from(stockReports)
    .where(
      and(
        eq(stockReports.houseableId, location.id),
        eq(stockReports.houseableType, location.type),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Totals for every branch, for the dashboard's branch-stock chart. */
export async function totalStockByShowroom(): Promise<Map<number, number>> {
  const rows = await db
    .select({
      houseableId: stockReports.houseableId,
      total: sql<number>`coalesce(sum(cast(${stockReports.stock} as decimal(20,2))), 0)`,
    })
    .from(stockReports)
    .where(eq(stockReports.houseableType, MorphType.ShowRoom))
    .groupBy(stockReports.houseableId);

  return new Map(rows.map((r) => [r.houseableId, Number(r.total)]));
}
