// ---------------------------------------------------------------------------
// Purchase orders - port of
// Modules/Purchase/Repositories/PurchaseOrderRepository.php.
//
// Lifecycle:
//   create()      draft order + line items + `purchase` stock movements
//   approve()     posts the purchase journal (supplier Cr, inventory/tax/
//                 charges Dr), a payment voucher per payment, and applies the
//                 line's `selling_price` to the SKU (recording the old price)
//   addToStock()  RECEIPT - increases stock, recomputes each SKU's weighted
//                 average `cost_of_goods` and logs it in
//                 `cost_of_goods_histories`
//   itemUpdate()/returnApprove()  the return flow
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import {
  contacts,
  costOfGoodsHistories,
  partNumbers,
  payments,
  productItemDetails,
  productSellingPriceHistories,
  productSku,
  products,
  purchaseOrders,
  receiveProducts,
  showRooms,
  stockReports,
  taxes,
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
} from '@/lib/inventory/stock';
import { createVoucher, VoucherType } from '@/lib/accounting/vouchers';
import { createJournalVoucher } from '@/lib/accounting/journal';
import {
  contactAccountId,
  defaultProductTaxAccountId,
  defaultPurchaseAccountId,
  defaultPurchaseReturnAccount,
  shippingOrOtherChargeExpenseId,
  taxAccountId,
} from '@/lib/accounting/defaults';
import { accountBalance, findContactAccount } from '@/lib/accounting/accounts';
import { VoucherApproval, voucherAutoApproved } from '@/lib/business-settings';
import { IntroPrefixId, introPrefixFor } from '@/lib/settings';
import { today, toDateString } from '@/lib/php-date';

/** `purchase_orders.status` - 0 pending, 1 approved/received. */
export const PurchaseStatus = { Pending: 0, Approved: 1 } as const;

/** `purchase_orders.is_paid` - 0 no, 1 partial, 2 paid. */
export const PurchasePaid = { No: 0, Partial: 1, Paid: 2 } as const;

/** `purchase_orders.added_to_stock` - 0 none, 1 fully received, 2 partial. */
export const PurchaseStock = { None: 0, Full: 1, Partial: 2 } as const;

/** `purchase_orders.return_status` - 0 pending, 1 approved, 2 default. */
export const PurchaseReturnStatus = { Pending: 0, Approved: 1, None: 2 } as const;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type PurchaseListFilters = {
  search?: string;
  showroomId?: number | null;
  allBranches?: boolean;
  status?: number;
  returnsOnly?: boolean;
  /** Orders not yet fully received - the "Recieve Your Product" screen. */
  pendingReceiptOnly?: boolean;
  page?: number;
  perPage?: number;
};

export async function listPurchaseOrders(filters: PurchaseListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [];
  if (!filters.allBranches && filters.showroomId != null) {
    where.push(eq(purchaseOrders.purchasableType, MorphType.ShowRoom));
    where.push(eq(purchaseOrders.purchasableId, filters.showroomId));
  }
  if (filters.status != null) where.push(eq(purchaseOrders.status, filters.status));
  if (filters.returnsOnly) {
    where.push(ne(purchaseOrders.returnStatus, PurchaseReturnStatus.None));
  }
  if (filters.pendingReceiptOnly) {
    where.push(ne(purchaseOrders.addedToStock, PurchaseStock.Full));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      or(
        like(purchaseOrders.invoiceNo, term),
        like(purchaseOrders.refNo, term),
        like(contacts.name, term),
      )!,
    );
  }

  const condition = where.length ? and(...where) : undefined;

  const rows = await db
    .select({
      order: purchaseOrders,
      supplierName: contacts.name,
      showroomName: showRooms.name,
      warehouseName: wareHouses.name,
      paidAmount: sql<number>`(
        select coalesce(sum(p.amount - p.return_amount), 0)
        from payments p
        where p.payable_id = ${purchaseOrders.id}
          and p.payable_type = ${MorphType.PurchaseOrder}
      )`,
    })
    .from(purchaseOrders)
    .leftJoin(contacts, eq(contacts.id, purchaseOrders.supplierId))
    .leftJoin(
      showRooms,
      and(
        eq(showRooms.id, purchaseOrders.purchasableId),
        eq(purchaseOrders.purchasableType, MorphType.ShowRoom),
      ),
    )
    .leftJoin(
      wareHouses,
      and(
        eq(wareHouses.id, purchaseOrders.purchasableId),
        eq(purchaseOrders.purchasableType, MorphType.WareHouse),
      ),
    )
    .where(condition)
    .orderBy(desc(purchaseOrders.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(purchaseOrders)
    .leftJoin(contacts, eq(contacts.id, purchaseOrders.supplierId))
    .where(condition);

  return {
    rows: rows.map((r) => ({
      ...r.order,
      supplierName: r.supplierName,
      locationName: r.showroomName ?? r.warehouseName,
      paidAmount: Number(r.paidAmount ?? 0),
    })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

export async function findPurchaseOrder(id: number) {
  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!order) return null;

  const items = await db
    .select({
      item: productItemDetails,
      sku: productSku.sku,
      productName: products.productName,
      costOfGoods: productSku.costOfGoods,
    })
    .from(productItemDetails)
    .leftJoin(productSku, eq(productSku.id, productItemDetails.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(
      and(
        eq(productItemDetails.itemableId, id),
        eq(productItemDetails.itemableType, MorphType.PurchaseOrder),
      ),
    )
    .orderBy(productItemDetails.id);

  const paymentRows = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.payableId, id),
        eq(payments.payableType, MorphType.PurchaseOrder),
      ),
    );

  const [supplier] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, order.supplierId))
    .limit(1);

  const received = await db
    .select()
    .from(receiveProducts)
    .where(eq(receiveProducts.purchaseId, id));

  return {
    order,
    items: items.map((r) => ({
      ...r.item,
      sku: r.sku,
      productName: r.productName,
      costOfGoods: Number(r.costOfGoods ?? 0),
    })),
    payments: paymentRows,
    supplier: supplier ?? null,
    received,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type PurchaseLineInput = {
  productSkuId: number;
  price: number;
  sellingPrice: number;
  quantity: number;
  tax: number;
  discount: number;
};

export type PurchaseInput = {
  supplierId: number;
  /** `"showroom-1"` / `"warehouse-2"`. */
  locationRef: string;
  paymentMethod?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  documents?: string[];
  itemAmount: number;
  date: string;
  totalQuantity: number;
  totalDiscountAmount: number;
  totalDiscount: number;
  discountType: number;
  totalAmount: number;
  /** Posted as `"<amount>-<tax_id>"`. */
  totalTax: string;
  shippingCharge: number;
  otherCharge: number;
  refNo?: string | null;
  lcNo?: string | null;
  cnfId?: number | null;
  lines: PurchaseLineInput[];
};

function parseTotalTax(value: string): { amount: number; taxId: number | null } {
  const [rawAmount, rawId] = String(value).split('-');
  const amount = Number(rawAmount);
  const taxId = Number(rawId);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    taxId: Number.isFinite(taxId) && taxId !== 0 ? taxId : null,
  };
}

/** `PurchaseOrderRepository::create($data)` */
export async function createPurchaseOrder(
  data: PurchaseInput,
  userId: number,
): Promise<number | null> {
  const location = parseLocation(data.locationRef);
  if (!location) return null;

  const tax = parseTotalTax(data.totalTax);

  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(purchaseOrders).values({
      supplierId: data.supplierId,
      paymentMethod: data.paymentMethod ?? null,
      shippingAddress: data.shippingAddress ?? null,
      notes: data.notes ?? null,
      documents: JSON.stringify(data.documents ?? []),
      amount: data.itemAmount,
      date: toDateString(data.date) ?? today(),
      totalQuantity: data.totalQuantity,
      totalDiscount: data.totalDiscountAmount,
      discountAmount: data.totalDiscount,
      discountType: data.discountType,
      payableAmount: data.totalAmount,
      totalVat: tax.amount,
      taxId: tax.taxId,
      shippingCharge: data.shippingCharge,
      otherCharge: data.otherCharge,
      refNo: data.refNo ?? null,
      lcNo: data.lcNo ?? null,
      cnfId: data.cnfId ?? null,
      invoiceNo: '',
      purchasableType: location.type,
      purchasableId: location.id,
      status: PurchaseStatus.Pending,
      isPaid: PurchasePaid.No,
      addedToStock: PurchaseStock.None,
      returnStatus: PurchaseReturnStatus.None,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const orderId = Number(inserted.insertId);

    // `PurchaseOrder::boot()` stamped the invoice number after insert.
    const prefix = (await introPrefixFor(IntroPrefixId.PurchaseInvoice)) ?? 'PI';
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    await tx
      .update(purchaseOrders)
      .set({ invoiceNo: `${prefix}-${yy}${mm}${userId}${orderId}` })
      .where(eq(purchaseOrders.id, orderId));

    for (const line of data.lines) {
      await tx.insert(productItemDetails).values({
        itemableId: orderId,
        itemableType: MorphType.PurchaseOrder,
        productSkuId: line.productSkuId,
        sellingPrice: line.sellingPrice,
        price: line.price,
        quantity: line.quantity,
        tax: line.tax,
        discount: line.discount,
        // The PHP stored the plain line total here, before tax/discount.
        subTotal: line.price * line.quantity,
        productableId: line.productSkuId,
        productableType: MorphType.ProductSku,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await recordMovement(
        {
          type: MovementType.Purchase,
          documentType: MorphType.PurchaseOrder,
          documentId: orderId,
          location,
          productSkuId: line.productSkuId,
          quantity: line.quantity,
          userId,
        },
        tx,
      );
    }

    return orderId;
  });
}

/**
 * `PurchaseOrderRepository::update($data, $id)`.
 *
 * The PHP updated the lines already on the order in place (also updating their
 * stock movement's `in_out`) and appended newly added ones. Posting one uniform
 * line list here reaches the same end state, with dropped lines removed.
 *
 * Editing is only offered before the order is received into stock, so no stock
 * levels move - only the pending `product_histories` rows are kept in step.
 */
export async function updatePurchaseOrder(
  orderId: number,
  data: PurchaseInput,
  userId: number,
): Promise<number | null> {
  const location = parseLocation(data.locationRef);
  if (!location) return null;

  const tax = parseTotalTax(data.totalTax);

  return runInTransaction(async (tx) => {
    await tx
      .update(purchaseOrders)
      .set({
        supplierId: data.supplierId,
        shippingAddress: data.shippingAddress ?? null,
        notes: data.notes ?? null,
        date: toDateString(data.date) ?? today(),
        purchasableType: location.type,
        purchasableId: location.id,
        amount: data.itemAmount,
        totalQuantity: data.totalQuantity,
        totalDiscount: data.totalDiscountAmount,
        discountAmount: data.totalDiscount,
        discountType: data.discountType,
        totalVat: tax.amount,
        taxId: tax.taxId,
        shippingCharge: data.shippingCharge,
        otherCharge: data.otherCharge,
        payableAmount: data.totalAmount,
        refNo: data.refNo ?? null,
        lcNo: data.lcNo ?? null,
        cnfId: data.cnfId ?? null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, orderId));

    if (data.documents?.length) {
      await tx
        .update(purchaseOrders)
        .set({ documents: JSON.stringify(data.documents) })
        .where(eq(purchaseOrders.id, orderId));
    }

    const existing = await tx
      .select()
      .from(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, orderId),
          eq(productItemDetails.itemableType, MorphType.PurchaseOrder),
        ),
      );
    const existingBySku = new Map(existing.map((item) => [item.productSkuId, item]));
    const seen = new Set<number>();

    for (const line of data.lines) {
      seen.add(line.productSkuId);
      const current = existingBySku.get(line.productSkuId);
      const subTotal = line.price * line.quantity;

      if (current) {
        await tx
          .update(productItemDetails)
          .set({
            price: line.price,
            sellingPrice: line.sellingPrice,
            quantity: line.quantity,
            tax: line.tax,
            discount: line.discount,
            subTotal,
            productableId: line.productSkuId,
            productableType: MorphType.ProductSku,
            updatedAt: new Date(),
          })
          .where(eq(productItemDetails.id, current.id));
      } else {
        await tx.insert(productItemDetails).values({
          itemableId: orderId,
          itemableType: MorphType.PurchaseOrder,
          productSkuId: line.productSkuId,
          sellingPrice: line.sellingPrice,
          price: line.price,
          quantity: line.quantity,
          tax: line.tax,
          discount: line.discount,
          subTotal,
          productableId: line.productSkuId,
          productableType: MorphType.ProductSku,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    for (const [skuId, item] of existingBySku) {
      if (seen.has(skuId)) continue;
      await tx.delete(productItemDetails).where(eq(productItemDetails.id, item.id));
    }

    // `$order->houses()->...->update(['in_out' => ...])` - rewritten wholesale.
    await deleteMovementsFor(MorphType.PurchaseOrder, orderId, tx);
    for (const line of data.lines) {
      await recordMovement(
        {
          type: MovementType.Purchase,
          documentType: MorphType.PurchaseOrder,
          documentId: orderId,
          location,
          productSkuId: line.productSkuId,
          quantity: line.quantity,
          userId,
        },
        tx,
      );
    }

    return orderId;
  });
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

/**
 * `PurchaseOrderRepository::approve($id)`.
 *
 * Posts the purchase journal and the payment vouchers, applies the new selling
 * prices, and settles any supplier credit against their open orders.
 */
export async function approvePurchaseOrder(
  orderId: number,
  userId: number,
): Promise<void> {
  const found = await findPurchaseOrder(orderId);
  if (!found) return;
  const { order, items, payments: paymentRows } = found;

  const supplierAccount = await contactAccountId(
    order.supplierId,
    MorphType.ContactModel,
  );

  const [purchaseAccount, productTaxAccount, chargeExpenseAccount] = await Promise.all([
    defaultPurchaseAccountId(),
    defaultProductTaxAccountId(),
    shippingOrOtherChargeExpenseId(),
  ]);

  const autoApprove = (await voucherAutoApproved(VoucherApproval.Purchase)) ? 1 : 0;

  await runInTransaction(async (tx) => {
    let taxAccountAmount = 0;

    for (const item of items) {
      taxAccountAmount +=
        ((Number(item.price) - Number(item.discount)) * item.quantity * Number(item.tax)) /
        100;

      // Applying the purchase's selling price to the SKU, keeping the old one.
      const [sku] = await tx
        .select({ id: productSku.id, sellingPrice: productSku.sellingPrice })
        .from(productSku)
        .where(eq(productSku.id, item.productSkuId))
        .limit(1);
      if (!sku) continue;

      await tx.insert(productSellingPriceHistories).values({
        productSkuId: sku.id,
        purchaseOrderId: orderId,
        oldPrice: sku.sellingPrice,
        newSellingPrice: item.sellingPrice,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx
        .update(productSku)
        .set({ sellingPrice: item.sellingPrice, updatedAt: new Date() })
        .where(eq(productSku.id, sku.id));
    }

    // --- Purchase journal -------------------------------------------------
    const subAccountIds: number[] = [];
    const subAmounts: number[] = [];
    const subNarrations: string[] = [];

    subAccountIds.push(purchaseAccount);
    subAmounts.push(
      Number(order.amount) - (Number(order.totalDiscount) + taxAccountAmount),
    );
    subNarrations.push('Product Purchase');

    if (taxAccountAmount > 0) {
      subAccountIds.push(productTaxAccount);
      subAmounts.push(taxAccountAmount);
      subNarrations.push('Purchase Tax');
    }

    if (Number(order.totalVat) > 0 && order.taxId) {
      const [taxRow] = await tx
        .select({ name: taxes.name, rate: taxes.rate })
        .from(taxes)
        .where(eq(taxes.id, order.taxId))
        .limit(1);

      subAccountIds.push(await taxAccountId(order.taxId));
      subAmounts.push((Number(order.amount) * Number(order.totalVat)) / 100);
      subNarrations.push(
        `${taxRow?.name ?? 'Tax'} ${taxRow?.rate ?? ''}Tax on Purchase`,
      );
    }

    const charges = Number(order.shippingCharge) + Number(order.otherCharge);
    if (charges > 0) {
      subAccountIds.push(chargeExpenseAccount);
      subAmounts.push(charges);
      subNarrations.push('Purchase Expense (Shipping and others charge)');
    }

    if (supplierAccount) {
      await createJournalVoucher(
        {
          amount: Number(order.payableAmount),
          date: today(),
          accountType: 'credit',
          accountId: supplierAccount,
          mainAmount: Number(order.payableAmount),
          narration: 'Product Purchase',
          subAccountId: [...subAccountIds].reverse(),
          subAmount: [...subAmounts].reverse(),
          subNarration: [...subNarrations].reverse(),
          referableId: orderId,
          referableType: MorphType.PurchaseOrder,
          isApprove: autoApprove,
          createdBy: userId,
        },
        tx,
      );
    }

    // --- Payment vouchers -------------------------------------------------
    for (const payment of paymentRows) {
      if (!supplierAccount) break;

      const isCash =
        payment.paymentMethod === 'cash' || payment.paymentMethod === 'quick cash';

      const creditAccountId = isCash
        ? (await findContactAccount(order.purchasableId, order.purchasableType))?.id
        : (payment.accountId ?? null);
      if (!creditAccountId) continue;

      const totalReceived = Number(payment.amount) + Number(payment.advanceAmount);
      const amount =
        Number(payment.returnAmount) > 0
          ? totalReceived - Number(payment.returnAmount)
          : totalReceived;

      await createVoucher(
        {
          // The PHP used BV only for the literal method "bank".
          voucherType: payment.paymentMethod === 'bank' ? VoucherType.Bank : VoucherType.Cash,
          amount,
          date: today(),
          paymentType: 'voucher_payment',
          creditAccountId,
          creditAccountAmount: amount,
          creditAccountNarration: [`Payment given by ${payment.paymentMethod}`],
          debitAccountId: supplierAccount,
          debitAccountAmount: amount,
          debitAccountNarration: ['Purchase Payment'],
          narration: `Payment given by ${payment.paymentMethod}`,
          bankName: payment.paymentMethod === 'bank' ? payment.bankName : null,
          bankBranch: payment.paymentMethod === 'bank' ? payment.branch : null,
          referableId: orderId,
          referableType: MorphType.PurchaseOrder,
          isApprove: autoApprove,
          createdBy: userId,
        },
        tx,
      );
    }

    await tx
      .update(purchaseOrders)
      .set({
        status: PurchaseStatus.Approved,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, orderId));
  });

  if (supplierAccount) {
    await settleSupplierCredit(order.supplierId, supplierAccount);
  }
}

/** The tail of `approve()` - apply a supplier credit to their open orders. */
async function settleSupplierCredit(
  supplierId: number,
  supplierAccountId: number,
): Promise<void> {
  const [account] = await db
    .select({ id: schema.chartAccounts.id, type: schema.chartAccounts.type })
    .from(schema.chartAccounts)
    .where(eq(schema.chartAccounts.id, supplierAccountId))
    .limit(1);
  if (!account) return;

  const balance = await accountBalance(account);
  if (balance >= 0) return;

  let extra = Math.abs(balance);

  const openOrders = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.supplierId, supplierId),
        ne(purchaseOrders.isPaid, PurchasePaid.Paid),
        eq(purchaseOrders.status, PurchaseStatus.Approved),
      ),
    )
    .orderBy(purchaseOrders.id);

  for (const order of openOrders) {
    if (extra <= 0) break;

    const [paidRow] = await db
      .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.payableId, order.id),
          eq(payments.payableType, MorphType.PurchaseOrder),
        ),
      );

    const due = Number(order.payableAmount) - Number(paidRow?.paid ?? 0);
    if (due <= 0) continue;

    const applied = extra >= due ? due : extra;

    await db.insert(payments).values({
      payableId: order.id,
      payableType: MorphType.PurchaseOrder,
      paymentMethod: 'Balance adjust',
      amount: applied,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db
      .update(purchaseOrders)
      .set({
        isPaid: extra >= due ? PurchasePaid.Paid : PurchasePaid.Partial,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, order.id));

    extra -= due;
  }
}

// ---------------------------------------------------------------------------
// Receipt into stock
// ---------------------------------------------------------------------------

export type ReceiveLine = {
  productSkuId: number;
  quantity: number;
  /** Comma-separated serials typed on the receipt form. */
  serialNumbers?: string;
};

/**
 * `addToStock($id, $data)`.
 *
 * The SKU's `cost_of_goods` is recalculated as a weighted average of the stock
 * already held and the quantity arriving, where the arriving unit cost is the
 * line price less its own discount and a flat share of the order discount:
 *
 *   flat share = order.total_discount / sum(line quantities)
 *   new COGS   = (onHand * oldCOGS + qty * (price - (discount + flatShare)))
 *                / (onHand + qty)
 */
export async function receivePurchaseIntoStock(
  orderId: number,
  lines: ReceiveLine[],
  userId: number,
): Promise<void> {
  const found = await findPurchaseOrder(orderId);
  if (!found) return;
  const { order, items } = found;

  const location: StockLocation = {
    id: order.purchasableId,
    type:
      order.purchasableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  const totalLineQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const flatAmountDiscount =
    totalLineQuantity > 0 ? Number(order.totalDiscount) / totalLineQuantity : 0;

  const receivedBySku = new Map(lines.map((l) => [l.productSkuId, l]));

  await runInTransaction(async (tx) => {
    for (const line of lines) {
      await tx.insert(receiveProducts).values({
        purchaseId: orderId,
        productSkuId: line.productSkuId,
        receiveQuantity: line.quantity,
        receiveDate: today(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (const item of items) {
      const line = receivedBySku.get(item.productSkuId);
      if (!line || line.quantity <= 0) continue;

      const increased = line.quantity;
      const onHand = await currentStock(location, item.productSkuId, tx);
      const previousCogs = item.costOfGoods;

      const unitCost =
        Number(item.price) - (Number(item.discount) + flatAmountDiscount);

      const newCogs =
        onHand + increased > 0
          ? (onHand * previousCogs + increased * unitCost) / (onHand + increased)
          : unitCost;

      await tx.insert(costOfGoodsHistories).values({
        costableType: MorphType.PurchaseOrder,
        costableId: orderId,
        storeableType: order.purchasableType,
        storeableId: order.purchasableId,
        date: today(),
        productSkuId: item.productSkuId,
        previousRemainingStock: onHand,
        newlyStock: increased,
        previousCostOfGoodsSold: previousCogs,
        newCostOfGoodsSold: newCogs,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx
        .update(productSku)
        .set({ costOfGoods: newCogs, updatedAt: new Date() })
        .where(eq(productSku.id, item.productSkuId));

      await adjustStock(location, item.productSkuId, increased, tx);

      // Serial numbers typed as a comma-separated list.
      if (line.serialNumbers) {
        const serials = line.serialNumbers
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (serials.length) {
          await tx.insert(partNumbers).values(
            serials.map((serial) => ({
              productSkuId: item.productSkuId,
              seiralNo: serial,
              isSold: 0,
              isReturned: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          );
        }
      }
    }

    // Fully received when the receipts add up to the ordered quantity.
    const [receivedRow] = await tx
      .select({
        total: sql<number>`coalesce(sum(${receiveProducts.receiveQuantity}), 0)`,
      })
      .from(receiveProducts)
      .where(eq(receiveProducts.purchaseId, orderId));

    const received = Number(receivedRow?.total ?? 0);

    await tx
      .update(purchaseOrders)
      .set({
        addedToStock:
          Number(order.totalQuantity) === received
            ? PurchaseStock.Full
            : PurchaseStock.Partial,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, orderId));
  });
}

/**
 * `adToStockOpening($data)` - opening stock entry, outside any purchase order.
 */
export async function addOpeningStock(
  data: {
    locationRef: string;
    productSkuId: number;
    quantity: number;
    stockDate: string;
    serialNumbers?: string;
  },
  userId: number,
): Promise<void> {
  const location = parseLocation(data.locationRef);
  if (!location) return;

  await runInTransaction(async (tx) => {
    const [sku] = await tx
      .select({ productId: productSku.productId })
      .from(productSku)
      .where(eq(productSku.id, data.productSkuId))
      .limit(1);

    // The movement is recorded against the PRODUCT (`$product->houses()`).
    if (sku?.productId) {
      await recordMovement(
        {
          type: 'begining' as never,
          documentType: MorphType.Product,
          documentId: sku.productId,
          location,
          productSkuId: data.productSkuId,
          quantity: data.quantity,
          date: toDateString(data.stockDate) ?? today(),
          userId,
        },
        tx,
      );
    }

    await adjustStock(location, data.productSkuId, data.quantity, tx);

    if (data.serialNumbers) {
      const serials = data.serialNumbers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (serials.length) {
        await tx.insert(partNumbers).values(
          serials.map((serial) => ({
            productSkuId: data.productSkuId,
            seiralNo: serial,
            isSold: 0,
            isReturned: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type PurchasePaymentInput = {
  paymentMethod: string;
  amount: number;
  accountId?: number | null;
  bankName?: string | null;
  branch?: string | null;
};

/** `PurchaseOrderRepository::payments($payments, $id)` */
export async function recordPurchasePayments(
  orderId: number,
  paymentInputs: PurchasePaymentInput[],
  userId: number,
): Promise<void> {
  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, orderId))
    .limit(1);
  if (!order) return;

  const [paidRow] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.payableId, orderId),
        eq(payments.payableType, MorphType.PurchaseOrder),
      ),
    );

  const paidBefore = Number(paidRow?.paid ?? 0);
  const payable = Number(order.payableAmount);
  let dueAmount = payable - paidBefore;
  let paidNow = 0;

  const supplierAccount = await contactAccountId(
    order.supplierId,
    MorphType.ContactModel,
  );
  const autoApprove = (await voucherAutoApproved(VoucherApproval.Purchase)) ? 1 : 0;

  await runInTransaction(async (tx) => {
    for (const payment of paymentInputs) {
      paidNow += payment.amount;

      let amount: number;
      let advanceAmount: number;
      if (payment.amount >= dueAmount) {
        if (dueAmount > 0) {
          amount = dueAmount;
          advanceAmount = payment.amount - amount;
        } else {
          amount = 0;
          advanceAmount = payment.amount;
        }
      } else {
        amount = payment.amount;
        advanceAmount = 0;
      }

      await tx.insert(payments).values({
        payableId: orderId,
        payableType: MorphType.PurchaseOrder,
        paymentMethod: payment.paymentMethod,
        amount,
        advanceAmount,
        accountId: payment.accountId ?? null,
        bankName: payment.bankName ?? null,
        branch: payment.branch ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // A payment voucher is only posted once the order is approved.
      if (order.status === PurchaseStatus.Approved && supplierAccount) {
        const isCash =
          payment.paymentMethod === 'cash' || payment.paymentMethod === 'quick cash';
        const creditAccountId = isCash
          ? (await findContactAccount(order.purchasableId, order.purchasableType))?.id
          : (payment.accountId ?? null);

        if (creditAccountId) {
          await createVoucher(
            {
              voucherType:
                payment.paymentMethod === 'bank' ? VoucherType.Bank : VoucherType.Cash,
              amount: payment.amount,
              date: today(),
              paymentType: 'voucher_payment',
              creditAccountId,
              creditAccountAmount: payment.amount,
              creditAccountNarration: [`Payment given by ${payment.paymentMethod}`],
              debitAccountId: supplierAccount,
              debitAccountAmount: payment.amount,
              debitAccountNarration: ['Purchase Payment'],
              narration: `Payment given by ${payment.paymentMethod}`,
              bankName: isCash ? null : (payment.bankName ?? null),
              bankBranch: isCash ? null : (payment.branch ?? null),
              referableId: orderId,
              referableType: MorphType.PurchaseOrder,
              isApprove: autoApprove,
              createdBy: userId,
            },
            tx,
          );
        }
      }

      dueAmount -= payment.amount;
    }

    const totalPaid = paidBefore + paidNow;
    const isPaid =
      payable <= totalPaid
        ? PurchasePaid.Paid
        : totalPaid > 0
          ? PurchasePaid.Partial
          : PurchasePaid.No;

    await tx
      .update(purchaseOrders)
      .set({ isPaid, updatedBy: userId, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, orderId));
  });
}

// ---------------------------------------------------------------------------
// Returns
// ---------------------------------------------------------------------------

/** `itemUpdate($data, $id)` - record a purchase return request. */
export async function recordPurchaseReturn(
  orderId: number,
  lines: Array<{ itemId: number; quantity: number }>,
  userId: number,
): Promise<void> {
  const found = await findPurchaseOrder(orderId);
  if (!found) return;
  const { order } = found;

  const location: StockLocation = {
    id: order.purchasableId,
    type:
      order.purchasableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  await runInTransaction(async (tx) => {
    await tx
      .update(purchaseOrders)
      .set({
        returnStatus: PurchaseReturnStatus.Pending,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, orderId));

    for (const line of lines) {
      const [item] = await tx
        .select()
        .from(productItemDetails)
        .where(eq(productItemDetails.id, line.itemId))
        .limit(1);
      if (!item) continue;

      await tx
        .update(productItemDetails)
        .set({
          returnQuantity: line.quantity,
          returnAmount: Number(item.price) * line.quantity,
          returnDate: new Date(),
          status: line.quantity > 0 ? 0 : item.status,
          updatedAt: new Date(),
        })
        .where(eq(productItemDetails.id, line.itemId));

      if (line.quantity > 0) {
        await recordMovement(
          {
            type: MovementType.PurchaseReturn,
            documentType: MorphType.PurchaseOrder,
            documentId: orderId,
            location,
            productSkuId: item.productSkuId,
            quantity: line.quantity,
            userId,
          },
          tx,
        );
      }
    }
  });

  if (await voucherAutoApproved(VoucherApproval.PurchaseReturn)) {
    await approvePurchaseReturn(orderId, userId);
  }
}

/** `returnApprove($id)` - accept the return: stock out, journals posted. */
export async function approvePurchaseReturn(
  orderId: number,
  userId: number,
): Promise<void> {
  const found = await findPurchaseOrder(orderId);
  if (!found) return;
  const { order, items } = found;

  const location: StockLocation = {
    id: order.purchasableId,
    type:
      order.purchasableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  const supplierAccount = await contactAccountId(
    order.supplierId,
    MorphType.ContactModel,
  );
  const purchaseReturnAccount = await defaultPurchaseReturnAccount();
  const autoApprove = (await voucherAutoApproved(VoucherApproval.PurchaseReturn))
    ? 1
    : 0;

  await runInTransaction(async (tx) => {
    let totalReturnAmount = 0;

    for (const item of items) {
      totalReturnAmount += Number(item.returnAmount);
      if (item.returnQuantity > 0) {
        // Returned goods leave the branch.
        await adjustStock(location, item.productSkuId, -item.returnQuantity, tx);
      }
    }

    if (totalReturnAmount > 0 && supplierAccount) {
      await createJournalVoucher(
        {
          amount: totalReturnAmount,
          date: today(),
          accountType: 'debit',
          accountId: supplierAccount,
          mainAmount: totalReturnAmount,
          narration: 'Purchase Return',
          subAccountId: [purchaseReturnAccount.id],
          subAmount: [totalReturnAmount],
          subNarration: ['Purchase Return Account'],
          referableId: orderId,
          referableType: MorphType.PurchaseOrder,
          isApprove: autoApprove,
          createdBy: userId,
        },
        tx,
      );
    }

    await tx
      .update(purchaseOrders)
      .set({
        returnStatus: PurchaseReturnStatus.Approved,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, orderId));
  });
}

/** `PurchaseOrderRepository::delete($id)` */
export async function deletePurchaseOrder(orderId: number): Promise<void> {
  await runInTransaction(async (tx) => {
    await deleteMovementsFor(MorphType.PurchaseOrder, orderId, tx);
    await tx
      .delete(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, orderId),
          eq(productItemDetails.itemableType, MorphType.PurchaseOrder),
        ),
      );
    await tx
      .delete(payments)
      .where(
        and(
          eq(payments.payableId, orderId),
          eq(payments.payableType, MorphType.PurchaseOrder),
        ),
      );
    await tx.delete(receiveProducts).where(eq(receiveProducts.purchaseId, orderId));
    await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId));
  });
}

/**
 * `supplierProducts($supplier)` / `suggestList()` - SKUs at or below their
 * alert level, optionally limited to one supplier's products.
 */
export async function stockAlertList(
  showroomId: number | null,
  supplierId?: number,
) {
  const conditions: SQL[] = [
    sql`${productSku.alertQuantity} >= cast(${stockReports.stock} as decimal(20,2))`,
  ];
  if (showroomId != null) {
    conditions.push(eq(stockReports.houseableType, MorphType.ShowRoom));
    conditions.push(eq(stockReports.houseableId, showroomId));
  }

  const rows = await db
    .selectDistinct({
      productSkuId: stockReports.productSkuId,
      sku: productSku.sku,
      productName: products.productName,
      stock: stockReports.stock,
      alertQuantity: productSku.alertQuantity,
      purchasePrice: productSku.purchasePrice,
    })
    .from(stockReports)
    .innerJoin(productSku, eq(productSku.id, stockReports.productSkuId))
    .innerJoin(products, eq(products.id, productSku.productId))
    .where(and(...conditions))
    .orderBy(desc(stockReports.id));

  if (!supplierId) return rows.map((r) => ({ ...r, stock: stockValue(r.stock) }));

  // Limit to SKUs this supplier has previously supplied.
  const supplied = await db
    .selectDistinct({ productSkuId: productItemDetails.productSkuId })
    .from(productItemDetails)
    .innerJoin(
      purchaseOrders,
      and(
        eq(purchaseOrders.id, productItemDetails.itemableId),
        eq(productItemDetails.itemableType, MorphType.PurchaseOrder),
      ),
    )
    .where(eq(purchaseOrders.supplierId, supplierId));

  const allowed = new Set(supplied.map((s) => s.productSkuId));
  return rows
    .filter((r) => allowed.has(r.productSkuId))
    .map((r) => ({ ...r, stock: stockValue(r.stock) }));
}

/** Cost-of-goods history, for the Product Costing screen. */
export async function costOfGoodsHistory(showroomId: number | null) {
  const conditions: SQL[] = [];
  if (showroomId != null) {
    conditions.push(eq(costOfGoodsHistories.storeableType, MorphType.ShowRoom));
    conditions.push(eq(costOfGoodsHistories.storeableId, showroomId));
  }

  return db
    .select({
      history: costOfGoodsHistories,
      sku: productSku.sku,
      productName: products.productName,
    })
    .from(costOfGoodsHistories)
    .leftJoin(productSku, eq(productSku.id, costOfGoodsHistories.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(costOfGoodsHistories.id))
    .limit(200);
}
