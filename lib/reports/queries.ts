// ---------------------------------------------------------------------------
// Reports - port of Modules/Report's repositories.
//
// Every report is branch-scoped the same way the PHP was: a system user may
// see everything, everyone else is pinned to `session('showroom_id')`.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, gte, lte, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  contacts,
  partNumbers,
  productItemDetails,
  productSku,
  products,
  purchaseOrders,
  sales,
  showRooms,
  users,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';

export type ReportScope = {
  showroomId?: number | null;
  allBranches?: boolean;
};

export type ReportFilters = ReportScope & {
  from?: string;
  to?: string;
  customerId?: number;
  supplierId?: number;
  retailerId?: number;
  userId?: number;
  productSkuId?: number;
  type?: number;
};

function saleScope(filters: ReportFilters): SQL[] {
  const where: SQL[] = [];
  if (filters.showroomId != null && !filters.allBranches) {
    where.push(eq(sales.saleableType, MorphType.ShowRoom));
    where.push(eq(sales.saleableId, filters.showroomId));
  }
  if (filters.from) where.push(gte(sales.date, filters.from));
  if (filters.to) where.push(lte(sales.date, filters.to));
  if (filters.type != null) where.push(eq(sales.type, filters.type));
  if (filters.retailerId) where.push(eq(sales.agentUserId, filters.retailerId));
  if (filters.customerId) where.push(eq(sales.customerId, filters.customerId));
  if (filters.userId) where.push(eq(sales.userId, filters.userId));
  return where;
}

/** `SalesReportRepository::search()` - approved sales only. */
export async function salesReport(filters: ReportFilters = {}) {
  const where = [...saleScope(filters), eq(sales.isApproved, 1)];

  const rows = await db
    .select({
      sale: sales,
      customerName: contacts.name,
      agentName: users.name,
      showroomName: showRooms.name,
      paidAmount: sql<number>`(
        select coalesce(sum(p.amount - p.return_amount), 0)
        from payments p
        where p.payable_id = ${sales.id} and p.payable_type = ${MorphType.Sale}
      )`,
    })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .leftJoin(users, eq(users.id, sales.agentUserId))
    .leftJoin(
      showRooms,
      and(eq(showRooms.id, sales.saleableId), eq(sales.saleableType, MorphType.ShowRoom)),
    )
    .where(and(...where))
    .orderBy(desc(sales.id))
    .limit(500);

  const totals = rows.reduce(
    (acc, r) => ({
      payable: acc.payable + Number(r.sale.payableAmount),
      paid: acc.paid + Number(r.paidAmount ?? 0),
      quantity: acc.quantity + Number(r.sale.totalQuantity),
    }),
    { payable: 0, paid: 0, quantity: 0 },
  );

  return { rows, totals };
}

/** `SalesReportRepository::searchSalesReturn()` - accepted returns. */
export async function salesReturnReport(filters: ReportFilters = {}) {
  const where = [...saleScope(filters), eq(sales.returnStatus, 1)];

  const rows = await db
    .select({
      sale: sales,
      customerName: contacts.name,
      showroomName: showRooms.name,
      returnAmount: sql<number>`(
        select coalesce(sum(i.return_amount), 0)
        from product_item_details i
        where i.itemable_id = ${sales.id} and i.itemable_type = ${MorphType.Sale}
      )`,
    })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .leftJoin(
      showRooms,
      and(eq(showRooms.id, sales.saleableId), eq(sales.saleableType, MorphType.ShowRoom)),
    )
    .where(and(...where))
    .orderBy(desc(sales.id))
    .limit(500);

  const total = rows.reduce((sum, r) => sum + Number(r.returnAmount ?? 0), 0);
  return { rows, total };
}

/** `SalesReportRepository::searchProduct()` - product-wise sales. */
export async function productSalesReport(filters: ReportFilters = {}) {
  const where: SQL[] = [eq(productItemDetails.itemableType, MorphType.Sale)];
  if (filters.productSkuId) {
    where.push(eq(productItemDetails.productSkuId, filters.productSkuId));
  }
  if (filters.from) where.push(gte(sales.date, filters.from));
  if (filters.to) where.push(lte(sales.date, filters.to));
  if (filters.showroomId != null && !filters.allBranches) {
    where.push(eq(sales.saleableType, MorphType.ShowRoom));
    where.push(eq(sales.saleableId, filters.showroomId));
  }

  const rows = await db
    .select({
      item: productItemDetails,
      invoiceNo: sales.invoiceNo,
      date: sales.date,
      customerName: contacts.name,
      sku: productSku.sku,
      productName: products.productName,
    })
    .from(productItemDetails)
    .innerJoin(sales, eq(sales.id, productItemDetails.itemableId))
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .leftJoin(productSku, eq(productSku.id, productItemDetails.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(and(...where))
    .orderBy(desc(productItemDetails.id))
    .limit(500);

  const totals = rows.reduce(
    (acc, r) => ({
      quantity: acc.quantity + r.item.quantity,
      amount: acc.amount + Number(r.item.subTotal),
    }),
    { quantity: 0, amount: 0 },
  );

  return { rows, totals };
}

// ---------------------------------------------------------------------------
// Purchase reports
// ---------------------------------------------------------------------------

function purchaseScope(filters: ReportFilters): SQL[] {
  const where: SQL[] = [];
  if (filters.showroomId != null && !filters.allBranches) {
    where.push(eq(purchaseOrders.purchasableType, MorphType.ShowRoom));
    where.push(eq(purchaseOrders.purchasableId, filters.showroomId));
  }
  if (filters.from) where.push(gte(purchaseOrders.date, filters.from));
  if (filters.to) where.push(lte(purchaseOrders.date, filters.to));
  if (filters.supplierId) where.push(eq(purchaseOrders.supplierId, filters.supplierId));
  return where;
}

export async function purchaseReport(filters: ReportFilters = {}) {
  const where = purchaseScope(filters);

  const rows = await db
    .select({
      order: purchaseOrders,
      supplierName: contacts.name,
      showroomName: showRooms.name,
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
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(purchaseOrders.id))
    .limit(500);

  const totals = rows.reduce(
    (acc, r) => ({
      payable: acc.payable + Number(r.order.payableAmount),
      paid: acc.paid + Number(r.paidAmount ?? 0),
      quantity: acc.quantity + Number(r.order.totalQuantity),
    }),
    { payable: 0, paid: 0, quantity: 0 },
  );

  return { rows, totals };
}

export async function productPurchaseReport(filters: ReportFilters = {}) {
  const where: SQL[] = [eq(productItemDetails.itemableType, MorphType.PurchaseOrder)];
  if (filters.productSkuId) {
    where.push(eq(productItemDetails.productSkuId, filters.productSkuId));
  }
  if (filters.from) where.push(gte(purchaseOrders.date, filters.from));
  if (filters.to) where.push(lte(purchaseOrders.date, filters.to));
  if (filters.showroomId != null && !filters.allBranches) {
    where.push(eq(purchaseOrders.purchasableType, MorphType.ShowRoom));
    where.push(eq(purchaseOrders.purchasableId, filters.showroomId));
  }

  const rows = await db
    .select({
      item: productItemDetails,
      invoiceNo: purchaseOrders.invoiceNo,
      date: purchaseOrders.date,
      supplierName: contacts.name,
      sku: productSku.sku,
      productName: products.productName,
    })
    .from(productItemDetails)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, productItemDetails.itemableId))
    .leftJoin(contacts, eq(contacts.id, purchaseOrders.supplierId))
    .leftJoin(productSku, eq(productSku.id, productItemDetails.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(and(...where))
    .orderBy(desc(productItemDetails.id))
    .limit(500);

  const totals = rows.reduce(
    (acc, r) => ({
      quantity: acc.quantity + r.item.quantity,
      amount: acc.amount + Number(r.item.subTotal),
    }),
    { quantity: 0, amount: 0 },
  );

  return { rows, totals };
}

// ---------------------------------------------------------------------------
// Contact reports
// ---------------------------------------------------------------------------

/** `customer_report.index` - a customer's invoices with what is still due. */
export async function customerReport(filters: ReportFilters = {}) {
  const where: SQL[] = [];
  if (filters.customerId) where.push(eq(sales.customerId, filters.customerId));
  if (filters.from) where.push(gte(sales.date, filters.from));
  if (filters.to) where.push(lte(sales.date, filters.to));
  where.push(eq(sales.isApproved, 1));

  const rows = await db
    .select({
      sale: sales,
      customerName: contacts.name,
      paidAmount: sql<number>`(
        select coalesce(sum(p.amount - p.return_amount), 0)
        from payments p
        where p.payable_id = ${sales.id} and p.payable_type = ${MorphType.Sale}
      )`,
    })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .where(and(...where))
    .orderBy(desc(sales.id))
    .limit(500);

  const totals = rows.reduce(
    (acc, r) => ({
      payable: acc.payable + Number(r.sale.payableAmount),
      paid: acc.paid + Number(r.paidAmount ?? 0),
    }),
    { payable: 0, paid: 0 },
  );

  return { rows, totals, due: totals.payable - totals.paid };
}

/** `supplier_report.index` */
export async function supplierReport(filters: ReportFilters = {}) {
  const where: SQL[] = [];
  if (filters.supplierId) where.push(eq(purchaseOrders.supplierId, filters.supplierId));
  if (filters.from) where.push(gte(purchaseOrders.date, filters.from));
  if (filters.to) where.push(lte(purchaseOrders.date, filters.to));

  const rows = await db
    .select({
      order: purchaseOrders,
      supplierName: contacts.name,
      paidAmount: sql<number>`(
        select coalesce(sum(p.amount - p.return_amount), 0)
        from payments p
        where p.payable_id = ${purchaseOrders.id}
          and p.payable_type = ${MorphType.PurchaseOrder}
      )`,
    })
    .from(purchaseOrders)
    .leftJoin(contacts, eq(contacts.id, purchaseOrders.supplierId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(purchaseOrders.id))
    .limit(500);

  const totals = rows.reduce(
    (acc, r) => ({
      payable: acc.payable + Number(r.order.payableAmount),
      paid: acc.paid + Number(r.paidAmount ?? 0),
    }),
    { payable: 0, paid: 0 },
  );

  return { rows, totals, due: totals.payable - totals.paid };
}

/** `serial._product_report.index` - where each serial number ended up. */
export async function serialNumberReport(filters: {
  productSkuId?: number;
  isSold?: number;
} = {}) {
  const where: SQL[] = [];
  if (filters.productSkuId) where.push(eq(partNumbers.productSkuId, filters.productSkuId));
  if (filters.isSold != null) where.push(eq(partNumbers.isSold, filters.isSold));

  return db
    .select({
      serial: partNumbers,
      sku: productSku.sku,
      productName: products.productName,
    })
    .from(partNumbers)
    .leftJoin(productSku, eq(productSku.id, partNumbers.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(partNumbers.id))
    .limit(500);
}

/** `purchase.history` / `sale.history` - the document history screens. */
export async function saleHistory(filters: ReportFilters = {}) {
  const where = saleScope(filters);
  return db
    .select({
      sale: sales,
      customerName: contacts.name,
      showroomName: showRooms.name,
    })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .leftJoin(
      showRooms,
      and(eq(showRooms.id, sales.saleableId), eq(sales.saleableType, MorphType.ShowRoom)),
    )
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(sales.id))
    .limit(500);
}

export async function purchaseHistory(filters: ReportFilters = {}) {
  const where = purchaseScope(filters);
  return db
    .select({
      order: purchaseOrders,
      supplierName: contacts.name,
      showroomName: showRooms.name,
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
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(purchaseOrders.id))
    .limit(500);
}

/** `income_by_customer` - approved sale totals grouped by customer. */
export async function incomeByCustomer(filters: ReportFilters = {}) {
  const where: SQL[] = [eq(sales.isApproved, 1)];
  if (filters.from) where.push(gte(sales.date, filters.from));
  if (filters.to) where.push(lte(sales.date, filters.to));

  const rows = await db
    .select({
      customerId: sales.customerId,
      customerName: contacts.name,
      invoices: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${sales.payableAmount}), 0)`,
    })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .where(and(...where))
    .groupBy(sales.customerId, contacts.name)
    .orderBy(desc(sql`coalesce(sum(${sales.payableAmount}), 0)`));

  return rows.map((r) => ({
    ...r,
    invoices: Number(r.invoices),
    total: Number(r.total),
  }));
}

/** `expense_by_supplier` - purchase totals grouped by supplier. */
export async function expenseBySupplier(filters: ReportFilters = {}) {
  const where: SQL[] = [];
  if (filters.from) where.push(gte(purchaseOrders.date, filters.from));
  if (filters.to) where.push(lte(purchaseOrders.date, filters.to));

  const rows = await db
    .select({
      supplierId: purchaseOrders.supplierId,
      supplierName: contacts.name,
      orders: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${purchaseOrders.payableAmount}), 0)`,
    })
    .from(purchaseOrders)
    .leftJoin(contacts, eq(contacts.id, purchaseOrders.supplierId))
    .where(where.length ? and(...where) : undefined)
    .groupBy(purchaseOrders.supplierId, contacts.name)
    .orderBy(desc(sql`coalesce(sum(${purchaseOrders.payableAmount}), 0)`));

  return rows.map((r) => ({
    ...r,
    orders: Number(r.orders),
    total: Number(r.total),
  }));
}

/** `sale_tax` - tax collected on approved sales. */
export async function salesTaxReport(filters: ReportFilters = {}) {
  const where: SQL[] = [eq(sales.isApproved, 1), ne(sales.totalTax, 0)];
  if (filters.from) where.push(gte(sales.date, filters.from));
  if (filters.to) where.push(lte(sales.date, filters.to));

  const rows = await db
    .select({
      sale: sales,
      customerName: contacts.name,
    })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .where(and(...where))
    .orderBy(desc(sales.id))
    .limit(500);

  const total = rows.reduce((sum, r) => sum + Number(r.sale.totalTax), 0);
  return { rows, total };
}
