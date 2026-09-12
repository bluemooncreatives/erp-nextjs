// ---------------------------------------------------------------------------
// Sale reads - port of the query side of
// Modules/Sale/Repositories/SaleRepository.php.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  comboProducts,
  contacts,
  payments,
  productItemDetails,
  productSku,
  products,
  sales,
  shippings,
  showRooms,
  users,
  wareHouses,
  type SalesRow,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';

/** `sales.status` - 0 Unpaid, 1 Paid, 2 Partial. */
export const SaleStatus = { Unpaid: 0, Paid: 1, Partial: 2 } as const;

/** `sales.type` - 0 Conditional, 1 Regular, 2 POS. */
export const SaleKind = { Conditional: 0, Regular: 1, Pos: 2 } as const;

/** `sales.return_status` - 0 Pending, 1 Accepted, 2 (default) nothing returned. */
export const SaleReturnStatus = { Pending: 0, Accepted: 1, None: 2 } as const;

export type SaleListFilters = {
  search?: string;
  /** Branch scope - `session('showroom_id')`. */
  showroomId?: number | null;
  /** System users see every branch. */
  allBranches?: boolean;
  type?: number;
  isApproved?: number;
  /** Only rows with an outstanding balance. */
  dueOnly?: boolean;
  /** Only rows with a return in progress or accepted. */
  returnsOnly?: boolean;
  page?: number;
  perPage?: number;
};

export type SaleListRow = SalesRow & {
  customerName: string | null;
  agentName: string | null;
  userName: string | null;
  paidAmount: number;
  locationName: string | null;
};

function branchCondition(filters: SaleListFilters): SQL | undefined {
  if (filters.allBranches || filters.showroomId == null) return undefined;
  return and(
    eq(sales.saleableType, MorphType.ShowRoom),
    eq(sales.saleableId, filters.showroomId),
  );
}

/** `all()` / `approvedSales()` / `itemList()` with the list screens' filters. */
export async function listSales(
  filters: SaleListFilters = {},
): Promise<{ rows: SaleListRow[]; total: number; page: number; perPage: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [];
  const branch = branchCondition(filters);
  if (branch) where.push(branch);
  if (filters.type != null) where.push(eq(sales.type, filters.type));
  if (filters.isApproved != null) where.push(eq(sales.isApproved, filters.isApproved));
  if (filters.dueOnly) where.push(ne(sales.status, SaleStatus.Paid));
  if (filters.returnsOnly) where.push(ne(sales.returnStatus, SaleReturnStatus.None));
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      or(
        like(sales.invoiceNo, term),
        like(sales.refNo, term),
        like(contacts.name, term),
      )!,
    );
  }

  const condition = where.length ? and(...where) : undefined;

  const rows = await db
    .select({
      sale: sales,
      customerName: contacts.name,
      agentName: users.name,
      showroomName: showRooms.name,
      warehouseName: wareHouses.name,
      paidAmount: sql<number>`(
        select coalesce(sum(p.amount - p.return_amount), 0)
        from payments p
        where p.payable_id = ${sales.id}
          and p.payable_type = ${MorphType.Sale}
      )`,
    })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .leftJoin(users, eq(users.id, sales.agentUserId))
    .leftJoin(
      showRooms,
      and(eq(showRooms.id, sales.saleableId), eq(sales.saleableType, MorphType.ShowRoom)),
    )
    .leftJoin(
      wareHouses,
      and(
        eq(wareHouses.id, sales.saleableId),
        eq(sales.saleableType, MorphType.WareHouse),
      ),
    )
    .where(condition)
    .orderBy(desc(sales.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sales)
    .leftJoin(contacts, eq(contacts.id, sales.customerId))
    .where(condition);

  return {
    rows: rows.map((r) => ({
      ...r.sale,
      customerName: r.customerName,
      agentName: r.agentName,
      userName: r.agentName,
      paidAmount: Number(r.paidAmount ?? 0),
      locationName: r.showroomName ?? r.warehouseName,
    })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

export type SaleItemRow = {
  id: number;
  productSkuId: number;
  productableId: number | null;
  productableType: string | null;
  price: number;
  quantity: number;
  tax: number;
  discount: number;
  subTotal: number;
  returnQuantity: number;
  returnAmount: number;
  status: number;
  sellingPrice: number;
  /** Resolved label - a SKU's product name, or the combo's name. */
  name: string | null;
  sku: string | null;
};

/** `find($id)` with items, payments and shipping. */
export async function findSale(id: number) {
  const [sale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  if (!sale) return null;

  const items = await saleItems(id);

  const paymentRows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.payableId, id), eq(payments.payableType, MorphType.Sale)))
    .orderBy(payments.id);

  const [shipping] = await db
    .select()
    .from(shippings)
    .where(eq(shippings.saleId, id))
    .orderBy(desc(shippings.id))
    .limit(1);

  const [customer] = sale.customerId
    ? await db.select().from(contacts).where(eq(contacts.id, sale.customerId)).limit(1)
    : [];

  const [agent] = sale.agentUserId
    ? await db.select().from(users).where(eq(users.id, sale.agentUserId)).limit(1)
    : [];

  const location = await saleLocation(sale);

  return {
    sale,
    items,
    payments: paymentRows,
    shipping: shipping ?? null,
    customer: customer ?? null,
    agent: agent ?? null,
    location,
  };
}

/** Line items with a readable product/combo name resolved. */
export async function saleItems(saleId: number): Promise<SaleItemRow[]> {
  const rows = await db
    .select({
      item: productItemDetails,
      productName: products.productName,
      sku: productSku.sku,
      comboName: comboProducts.name,
    })
    .from(productItemDetails)
    .leftJoin(productSku, eq(productSku.id, productItemDetails.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .leftJoin(
      comboProducts,
      and(
        eq(comboProducts.id, productItemDetails.productableId),
        eq(productItemDetails.productableType, MorphType.ComboProduct),
      ),
    )
    .where(
      and(
        eq(productItemDetails.itemableId, saleId),
        eq(productItemDetails.itemableType, MorphType.Sale),
      ),
    )
    .orderBy(productItemDetails.id);

  return rows.map((r) => ({
    id: r.item.id,
    productSkuId: r.item.productSkuId,
    productableId: r.item.productableId,
    productableType: r.item.productableType,
    price: Number(r.item.price),
    quantity: r.item.quantity,
    tax: Number(r.item.tax),
    discount: Number(r.item.discount),
    subTotal: Number(r.item.subTotal),
    returnQuantity: r.item.returnQuantity,
    returnAmount: Number(r.item.returnAmount),
    status: r.item.status,
    sellingPrice: Number(r.item.sellingPrice),
    name:
      r.item.productableType === MorphType.ComboProduct
        ? r.comboName
        : (r.productName ?? r.sku),
    sku: r.sku,
  }));
}

/** The branch or warehouse the sale was raised against (`saleable`). */
export async function saleLocation(sale: Pick<SalesRow, 'saleableId' | 'saleableType'>) {
  if (!sale.saleableId) return null;
  if (sale.saleableType === MorphType.WareHouse) {
    const [row] = await db
      .select({ id: wareHouses.id, name: wareHouses.name })
      .from(wareHouses)
      .where(eq(wareHouses.id, sale.saleableId))
      .limit(1);
    return row ? { ...row, kind: 'warehouse' as const } : null;
  }
  const [row] = await db
    .select({ id: showRooms.id, name: showRooms.name })
    .from(showRooms)
    .where(eq(showRooms.id, sale.saleableId))
    .limit(1);
  return row ? { ...row, kind: 'showroom' as const } : null;
}

/** `getBillingAmountAttribute()` - paid and due for one sale. */
export async function saleBilling(
  saleId: number,
  payableAmount: number,
): Promise<{ paidAmount: number; dueAmount: number }> {
  const [row] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.payableId, saleId), eq(payments.payableType, MorphType.Sale)));

  const paidAmount = Number(row?.paid ?? 0);
  return { paidAmount, dueAmount: payableAmount - paidAmount };
}

/** `customerInvoiceList($customer_id)` - unpaid invoices for a customer. */
export async function customerInvoiceList(customerId: number) {
  return db
    .select()
    .from(sales)
    .where(and(eq(sales.customerId, customerId), ne(sales.status, SaleStatus.Paid)))
    .orderBy(desc(sales.id));
}

/** `retailerInvoiceList($user_id)` */
export async function retailerInvoiceList(userId: number) {
  return db
    .select()
    .from(sales)
    .where(and(eq(sales.agentUserId, userId), ne(sales.status, SaleStatus.Paid)))
    .orderBy(desc(sales.id));
}

/** `customerDues($customer_id, $sale_id)` - totals across a customer's OTHER sales. */
export async function customerDues(customerId: number, excludeSaleId: number) {
  const [row] = await db
    .select({
      payablePrice: sql<number>`coalesce(sum(${productItemDetails.subTotal}), 0)`,
    })
    .from(productItemDetails)
    .innerJoin(
      sales,
      and(
        eq(sales.id, productItemDetails.itemableId),
        eq(productItemDetails.itemableType, MorphType.Sale),
      ),
    )
    .where(and(eq(sales.customerId, customerId), ne(sales.id, excludeSaleId)));

  const [paidRow] = await db
    .select({ paidPrice: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(
      sales,
      and(eq(sales.id, payments.payableId), eq(payments.payableType, MorphType.Sale)),
    )
    .where(and(eq(sales.customerId, customerId), ne(sales.id, excludeSaleId)));

  return {
    payablePrice: Number(row?.payablePrice ?? 0),
    paidPrice: Number(paidRow?.paidPrice ?? 0),
  };
}
