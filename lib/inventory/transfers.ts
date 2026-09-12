// ---------------------------------------------------------------------------
// Stock transfers and adjustments.
// Ports Modules/Inventory/Repositories/StockTransferRepository.php and
// StockAdjustmentRepository.php.
//
// A transfer moves stock between two locations in three steps:
//   create()       records the transfer and its lines (no stock moves yet)
//   sendToHouse()  stamps `sent_at`
//   stockReceive() moves the stock: the sender is decreased, the receiver
//                  increased, both by (quantity - return_quantity)
//
// An adjustment writes off stock at one location; `statusChange()` applies it.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  productItemDetails,
  productSku,
  products,
  showRooms,
  stockAdjustmentProducts,
  stockAdjustments,
  stockReports,
  stockTransfers,
  wareHouses,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import {
  MovementType,
  adjustStock,
  currentStock,
  deleteMovementsFor,
  parseLocation,
  recordMovement,
  stockValue,
  type StockLocation,
} from './stock';
import { today, toDateString } from '@/lib/php-date';

/** The PHP returned `1` from `stockReceive()` when the sender lacked stock. */
export const INSUFFICIENT_STOCK = 1 as const;

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export type TransferLineInput = {
  productSkuId: number;
  price: number;
  quantity: number;
};

export type TransferInput = {
  /** `"showroom-1"` / `"warehouse-2"`. */
  fromRef: string;
  toRef: string;
  date: string;
  notes?: string | null;
  documents?: string[];
  lines: TransferLineInput[];
};

export async function listStockTransfers(filters: {
  showroomId?: number | null;
  allBranches?: boolean;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const condition =
    filters.allBranches || filters.showroomId == null
      ? undefined
      : and(
          eq(stockTransfers.sendableType, MorphType.ShowRoom),
          eq(stockTransfers.sendableId, filters.showroomId),
        );

  const rows = await db
    .select()
    .from(stockTransfers)
    .where(condition)
    .orderBy(desc(stockTransfers.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockTransfers)
    .where(condition);

  // Resolve both location names for the listing.
  const withNames = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      fromName: await locationName(row.sendableId, row.sendableType),
      toName: await locationName(row.receivableId, row.receivableType),
    })),
  );

  return {
    rows: withNames,
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

async function locationName(id: number, type: string): Promise<string | null> {
  if (type === MorphType.WareHouse) {
    const [row] = await db
      .select({ name: wareHouses.name })
      .from(wareHouses)
      .where(eq(wareHouses.id, id))
      .limit(1);
    return row?.name ?? null;
  }
  const [row] = await db
    .select({ name: showRooms.name })
    .from(showRooms)
    .where(eq(showRooms.id, id))
    .limit(1);
  return row?.name ?? null;
}

export async function findStockTransfer(id: number) {
  const [transfer] = await db
    .select()
    .from(stockTransfers)
    .where(eq(stockTransfers.id, id))
    .limit(1);
  if (!transfer) return null;

  const items = await db
    .select({
      item: productItemDetails,
      sku: productSku.sku,
      productName: products.productName,
    })
    .from(productItemDetails)
    .leftJoin(productSku, eq(productSku.id, productItemDetails.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(
      and(
        eq(productItemDetails.itemableId, id),
        eq(productItemDetails.itemableType, MorphType.StockTransfer),
      ),
    );

  return {
    transfer,
    items: items.map((r) => ({ ...r.item, sku: r.sku, productName: r.productName })),
    fromName: await locationName(transfer.sendableId, transfer.sendableType),
    toName: await locationName(transfer.receivableId, transfer.receivableType),
  };
}

/** `StockTransferRepository::create($data)` */
export async function createStockTransfer(
  data: TransferInput,
  userId: number,
): Promise<number | null> {
  const from = parseLocation(data.fromRef);
  const to = parseLocation(data.toRef);
  if (!from || !to) return null;

  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(stockTransfers).values({
      date: toDateString(data.date) ?? today(),
      notes: data.notes ?? null,
      documents: JSON.stringify(data.documents ?? []),
      sendableId: from.id,
      sendableType: from.type,
      receivableId: to.id,
      receivableType: to.type,
      status: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const transferId = Number(inserted.insertId);

    for (const line of data.lines) {
      await tx.insert(productItemDetails).values({
        itemableId: transferId,
        itemableType: MorphType.StockTransfer,
        productSkuId: line.productSkuId,
        price: line.price,
        quantity: line.quantity,
        subTotal: line.price * line.quantity,
        productableId: line.productSkuId,
        productableType: MorphType.ProductSku,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    void userId;
    return transferId;
  });
}

/** `sendToHouse($id)` - marks the goods as dispatched. */
export async function sendStockTransfer(id: number): Promise<void> {
  await db
    .update(stockTransfers)
    .set({ sentAt: today(), updatedAt: new Date() })
    .where(eq(stockTransfers.id, id));
}

/**
 * `stockReceive($id)` - the receiving location takes the stock in and the
 * sender gives it up. Refuses when the sender no longer holds enough.
 */
export async function receiveStockTransfer(
  id: number,
  userId: number,
): Promise<typeof INSUFFICIENT_STOCK | void> {
  const found = await findStockTransfer(id);
  if (!found) return;

  const { transfer, items } = found;

  const sender: StockLocation = {
    id: transfer.sendableId,
    type:
      transfer.sendableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };
  const receiver: StockLocation = {
    id: transfer.receivableId,
    type:
      transfer.receivableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  // Check every line before moving anything.
  for (const item of items) {
    const onHand = await currentStock(sender, item.productSkuId);
    const moving = item.quantity - item.returnQuantity;
    if (onHand < moving) return INSUFFICIENT_STOCK;
  }

  await runInTransaction(async (tx) => {
    for (const item of items) {
      const moving = item.quantity - item.returnQuantity;

      await adjustStock(receiver, item.productSkuId, moving, tx);
      await adjustStock(sender, item.productSkuId, -moving, tx);

      await recordMovement(
        {
          type: MovementType.StockTransfer,
          documentType: MorphType.StockTransfer,
          documentId: id,
          location: receiver,
          productSkuId: item.productSkuId,
          quantity: moving,
          status: 1,
          userId,
        },
        tx,
      );
    }

    await tx
      .update(stockTransfers)
      .set({ receivedAt: today(), status: 1, updatedAt: new Date() })
      .where(eq(stockTransfers.id, id));
  });
}

/** `statusChange($id)` */
export async function setTransferStatus(id: number, status = 1): Promise<void> {
  await db
    .update(stockTransfers)
    .set({ status, updatedAt: new Date() })
    .where(eq(stockTransfers.id, id));
}

/** `StockTransferRepository::delete($id)` */
export async function deleteStockTransfer(id: number): Promise<void> {
  await runInTransaction(async (tx) => {
    await tx
      .delete(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, id),
          eq(productItemDetails.itemableType, MorphType.StockTransfer),
        ),
      );
    await deleteMovementsFor(MorphType.StockTransfer, id, tx);
    await tx.delete(stockTransfers).where(eq(stockTransfers.id, id));
  });
}

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

export type AdjustmentLineInput = {
  productSkuId: number;
  quantity: number;
};

export type AdjustmentInput = {
  locationRef: string;
  refNo?: string | null;
  recoveryAmount: number;
  date: string;
  reason?: string | null;
  lines: AdjustmentLineInput[];
};

export async function listStockAdjustments(filters: {
  showroomId?: number | null;
  allBranches?: boolean;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const condition =
    filters.allBranches || filters.showroomId == null
      ? undefined
      : and(
          eq(stockAdjustments.adjustableType, MorphType.ShowRoom),
          eq(stockAdjustments.adjustableId, filters.showroomId),
        );

  const rows = await db
    .select()
    .from(stockAdjustments)
    .where(condition)
    .orderBy(desc(stockAdjustments.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockAdjustments)
    .where(condition);

  const withNames = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      locationName:
        row.adjustableId != null && row.adjustableType
          ? await locationName(row.adjustableId, row.adjustableType)
          : null,
    })),
  );

  return { rows: withNames, total: Number(countRow?.count ?? 0), page, perPage };
}

export async function findStockAdjustment(id: number) {
  const [adjustment] = await db
    .select()
    .from(stockAdjustments)
    .where(eq(stockAdjustments.id, id))
    .limit(1);
  if (!adjustment) return null;

  const items = await db
    .select({
      item: stockAdjustmentProducts,
      sku: productSku.sku,
      productName: products.productName,
    })
    .from(stockAdjustmentProducts)
    .leftJoin(productSku, eq(productSku.id, stockAdjustmentProducts.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(eq(stockAdjustmentProducts.stockAdjustmentId, id));

  return {
    adjustment,
    items: items.map((r) => ({ ...r.item, sku: r.sku, productName: r.productName })),
    locationName:
      adjustment.adjustableId != null && adjustment.adjustableType
        ? await locationName(adjustment.adjustableId, adjustment.adjustableType)
        : null,
  };
}

/** `StockAdjustmentRepository::create($data)` */
export async function createStockAdjustment(
  data: AdjustmentInput,
  userId: number,
): Promise<number | null> {
  const location = parseLocation(data.locationRef);
  if (!location) return null;

  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(stockAdjustments).values({
      refNo: data.refNo ?? null,
      recoveryAmount: data.recoveryAmount,
      date: toDateString(data.date) ?? today(),
      reason: data.reason ?? null,
      adjustableId: location.id,
      adjustableType: location.type,
      status: 0,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const adjustmentId = Number(inserted.insertId);

    for (const line of data.lines) {
      // The unit price is the SKU's purchase price, as the PHP read it.
      const [sku] = await tx
        .select({ purchasePrice: productSku.purchasePrice })
        .from(productSku)
        .where(eq(productSku.id, line.productSkuId))
        .limit(1);

      const price = Number(sku?.purchasePrice ?? 0);

      await tx.insert(stockAdjustmentProducts).values({
        stockAdjustmentId: adjustmentId,
        unitPrice: price,
        productSkuId: line.productSkuId,
        qty: line.quantity,
        subtotal: price * line.quantity,
        status: 0,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await recordMovement(
        {
          type: MovementType.StockAdjustment,
          documentType: MorphType.StockAdjustment,
          documentId: adjustmentId,
          location,
          productSkuId: line.productSkuId,
          quantity: line.quantity,
          userId,
        },
        tx,
      );
    }

    return adjustmentId;
  });
}

/**
 * `StockAdjustmentRepository::statusChange($id)` - apply the adjustment:
 * each movement's quantity is taken OUT of the location's stock.
 */
export async function applyStockAdjustment(
  id: number,
  userId: number,
): Promise<void> {
  const { productHistories } = await import('@/lib/db/schema');

  await runInTransaction(async (tx) => {
    const movements = await tx
      .select()
      .from(productHistories)
      .where(
        and(
          eq(productHistories.houseableType, MorphType.StockAdjustment),
          eq(productHistories.houseableId, id),
        ),
      );

    for (const movement of movements) {
      await tx
        .update(productHistories)
        .set({ status: 1, updatedAt: new Date() })
        .where(eq(productHistories.id, movement.id));

      const location: StockLocation = {
        id: movement.itemableId,
        type:
          movement.itemableType === MorphType.WareHouse
            ? MorphType.WareHouse
            : MorphType.ShowRoom,
      };

      await adjustStock(location, movement.productSkuId, -movement.inOut, tx);
    }

    await tx
      .update(stockAdjustments)
      .set({ status: 1, updatedBy: userId, updatedAt: new Date() })
      .where(eq(stockAdjustments.id, id));
  });
}

export async function deleteStockAdjustment(id: number): Promise<void> {
  await runInTransaction(async (tx) => {
    await deleteMovementsFor(MorphType.StockAdjustment, id, tx);
    await tx
      .delete(stockAdjustmentProducts)
      .where(eq(stockAdjustmentProducts.stockAdjustmentId, id));
    await tx.delete(stockAdjustments).where(eq(stockAdjustments.id, id));
  });
}

// ---------------------------------------------------------------------------
// Stock list / movement reports
// ---------------------------------------------------------------------------

/** `stockList()` - the Stock List screen. */
export async function stockList(filters: {
  showroomId?: number | null;
  allBranches?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 50;

  const conditions = [];
  if (!filters.allBranches && filters.showroomId != null) {
    conditions.push(eq(stockReports.houseableType, MorphType.ShowRoom));
    conditions.push(eq(stockReports.houseableId, filters.showroomId));
  }
  if (filters.search) {
    conditions.push(
      sql`(${products.productName} like ${`%${filters.search}%`}
           or ${productSku.sku} like ${`%${filters.search}%`})`,
    );
  }

  const condition = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: stockReports.id,
      productSkuId: stockReports.productSkuId,
      stock: stockReports.stock,
      houseableId: stockReports.houseableId,
      houseableType: stockReports.houseableType,
      sku: productSku.sku,
      productName: products.productName,
      alertQuantity: productSku.alertQuantity,
      purchasePrice: productSku.purchasePrice,
      sellingPrice: productSku.sellingPrice,
      showroomName: showRooms.name,
      warehouseName: wareHouses.name,
    })
    .from(stockReports)
    .innerJoin(productSku, eq(productSku.id, stockReports.productSkuId))
    .innerJoin(products, eq(products.id, productSku.productId))
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
    .where(condition)
    .orderBy(desc(stockReports.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockReports)
    .innerJoin(productSku, eq(productSku.id, stockReports.productSkuId))
    .innerJoin(products, eq(products.id, productSku.productId))
    .where(condition);

  return {
    rows: rows.map((r) => ({
      ...r,
      stock: stockValue(r.stock),
      locationName: r.showroomName ?? r.warehouseName,
    })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

/** `product_movement.index` - every movement for a SKU. */
export async function productMovement(filters: {
  productSkuId?: number;
  showroomId?: number | null;
  allBranches?: boolean;
  limit?: number;
}) {
  const { productHistories } = await import('@/lib/db/schema');

  const conditions = [];
  if (filters.productSkuId) {
    conditions.push(eq(productHistories.productSkuId, filters.productSkuId));
  }
  if (!filters.allBranches && filters.showroomId != null) {
    conditions.push(eq(productHistories.itemableType, MorphType.ShowRoom));
    conditions.push(eq(productHistories.itemableId, filters.showroomId));
  }

  return db
    .select({
      id: productHistories.id,
      type: productHistories.type,
      date: productHistories.date,
      inOut: productHistories.inOut,
      status: productHistories.status,
      productSkuId: productHistories.productSkuId,
      houseableType: productHistories.houseableType,
      houseableId: productHistories.houseableId,
      sku: productSku.sku,
      productName: products.productName,
    })
    .from(productHistories)
    .leftJoin(productSku, eq(productSku.id, productHistories.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(productHistories.id))
    .limit(filters.limit ?? 200);
}
