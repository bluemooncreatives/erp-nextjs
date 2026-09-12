// ---------------------------------------------------------------------------
// Quotations - port of Modules/Quotation/Repositories/QuotationRepository.php.
//
// A quotation is a sale that has not happened yet: same line items
// (`product_item_details` with `itemable_type` = Quotation), no stock movement
// and no ledger entries. Converting one re-points its line items at a new sale
// (`SaleRepository::quotationToSale`) and sets `convert_status = 1`.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  comboProducts,
  contacts,
  productItemDetails,
  productSku,
  products,
  quotations,
  showRooms,
  users,
  wareHouses,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { parseLocation } from '@/lib/inventory/stock';
import { IntroPrefixId, introPrefixFor } from '@/lib/settings';
import { today, toDateString } from '@/lib/php-date';

/** `quotations.convert_status` - 1 once turned into a sale. */
export const QuotationConvertStatus = { Open: 0, Converted: 1 } as const;

export type QuotationLineInput = {
  productableId: number;
  productSkuId: number;
  isCombo?: boolean;
  price: number;
  quantity: number;
  tax: number;
  discount: number;
};

export type QuotationInput = {
  customerId: number;
  /** `"showroom-1"` / `"warehouse-2"`, or empty. */
  locationRef?: string | null;
  date: string;
  validTillDate: string;
  notes?: string | null;
  shippingAddress?: string | null;
  documents?: string[];
  refNo?: string | null;
  itemAmount: number;
  totalQuantity: number;
  /** `"<amount>-<tax_id>"`. */
  totalTax: string;
  totalDiscountAmount: number;
  discountType: number;
  totalDiscount: number;
  totalAmount: number;
  shippingCharge: number;
  otherCharge: number;
  lines: QuotationLineInput[];
};

export async function listQuotations(filters: {
  search?: string;
  showroomId?: number | null;
  allBranches?: boolean;
  convertStatus?: number;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [];
  if (!filters.allBranches && filters.showroomId != null) {
    where.push(eq(quotations.quotationableType, MorphType.ShowRoom));
    where.push(eq(quotations.quotationableId, filters.showroomId));
  }
  if (filters.convertStatus != null) {
    where.push(eq(quotations.convertStatus, filters.convertStatus));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      or(
        like(quotations.invoiceNo, term),
        like(quotations.refNo, term),
        like(contacts.name, term),
      )!,
    );
  }

  const condition = where.length ? and(...where) : undefined;

  const rows = await db
    .select({
      quotation: quotations,
      customerName: contacts.name,
      userName: users.name,
      showroomName: showRooms.name,
      warehouseName: wareHouses.name,
    })
    .from(quotations)
    .leftJoin(contacts, eq(contacts.id, quotations.customerId))
    .leftJoin(users, eq(users.id, quotations.userId))
    .leftJoin(
      showRooms,
      and(
        eq(showRooms.id, quotations.quotationableId),
        eq(quotations.quotationableType, MorphType.ShowRoom),
      ),
    )
    .leftJoin(
      wareHouses,
      and(
        eq(wareHouses.id, quotations.quotationableId),
        eq(quotations.quotationableType, MorphType.WareHouse),
      ),
    )
    .where(condition)
    .orderBy(desc(quotations.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(quotations)
    .leftJoin(contacts, eq(contacts.id, quotations.customerId))
    .where(condition);

  return {
    rows: rows.map((r) => ({
      ...r.quotation,
      customerName: r.customerName,
      userName: r.userName,
      locationName: r.showroomName ?? r.warehouseName,
    })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

export async function findQuotation(id: number) {
  const [quotation] = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, id))
    .limit(1);
  if (!quotation) return null;

  const items = await db
    .select({
      item: productItemDetails,
      sku: productSku.sku,
      productName: products.productName,
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
        eq(productItemDetails.itemableId, id),
        eq(productItemDetails.itemableType, MorphType.Quotation),
      ),
    )
    .orderBy(productItemDetails.id);

  const [customer] = quotation.customerId
    ? await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, quotation.customerId))
        .limit(1)
    : [];

  return {
    quotation,
    items: items.map((r) => ({
      ...r.item,
      name:
        r.item.productableType === MorphType.ComboProduct
          ? r.comboName
          : (r.productName ?? r.sku),
      sku: r.sku,
    })),
    customer: customer ?? null,
  };
}

function parseTotalTax(value: string): { amount: number; taxId: number | null } {
  const [rawAmount, rawId] = String(value).split('-');
  const amount = Number(rawAmount);
  const taxId = Number(rawId);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    taxId: Number.isFinite(taxId) && taxId !== 0 ? taxId : null,
  };
}

/** `QuotationRepository::create($data)` */
export async function createQuotation(
  data: QuotationInput,
  userId: number,
): Promise<number> {
  const location = data.locationRef ? parseLocation(data.locationRef) : null;
  const tax = parseTotalTax(data.totalTax);

  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(quotations).values({
      customerId: data.customerId,
      userId,
      date: new Date(`${toDateString(data.date) ?? today()}T00:00:00Z`),
      validTillDate: toDateString(data.validTillDate),
      notes: data.notes ?? null,
      shippingAddress: data.shippingAddress ?? null,
      document: JSON.stringify(data.documents ?? []),
      amount: data.itemAmount,
      refNo: data.refNo ?? null,
      totalQuantity: data.totalQuantity,
      totalVat: tax.amount,
      totalDiscount: data.totalDiscountAmount,
      discountType: data.discountType,
      discountAmount: data.totalDiscount,
      payableAmount: data.totalAmount,
      shippingCharge: data.shippingCharge,
      otherCharge: data.otherCharge,
      quotationableId: location?.id ?? null,
      quotationableType: location?.type ?? null,
      status: 0,
      convertStatus: QuotationConvertStatus.Open,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const quotationId = Number(inserted.insertId);

    // `Quotation::boot()` - QTA-yymm<user><id>
    const prefix = (await introPrefixFor(IntroPrefixId.Quotation)) ?? 'QTA';
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    await tx
      .update(quotations)
      .set({ invoiceNo: `${prefix}-${yy}${mm}${userId}${quotationId}` })
      .where(eq(quotations.id, quotationId));

    for (const line of data.lines) {
      const lineTotal = line.price * line.quantity;
      const calculatedTax = (lineTotal * line.tax) / 100;
      const calculatedDiscount = (lineTotal * line.discount) / 100;

      await tx.insert(productItemDetails).values({
        itemableId: quotationId,
        itemableType: MorphType.Quotation,
        productSkuId: line.productSkuId,
        price: line.price,
        quantity: line.quantity,
        tax: line.isCombo ? 0 : line.tax,
        discount: line.isCombo ? 0 : line.discount,
        subTotal: line.isCombo
          ? lineTotal
          : lineTotal + calculatedTax - calculatedDiscount,
        productableId: line.productableId,
        productableType: line.isCombo ? MorphType.ComboProduct : MorphType.ProductSku,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return quotationId;
  });
}

/** `QuotationRepository::update($data, $id)` - replaces the line items. */
export async function updateQuotation(
  id: number,
  data: QuotationInput,
  userId: number,
): Promise<void> {
  const location = data.locationRef ? parseLocation(data.locationRef) : null;
  const tax = parseTotalTax(data.totalTax);

  await runInTransaction(async (tx) => {
    await tx
      .update(quotations)
      .set({
        customerId: data.customerId,
        date: new Date(`${toDateString(data.date) ?? today()}T00:00:00Z`),
        validTillDate: toDateString(data.validTillDate),
        notes: data.notes ?? null,
        shippingAddress: data.shippingAddress ?? null,
        amount: data.itemAmount,
        refNo: data.refNo ?? null,
        totalQuantity: data.totalQuantity,
        totalVat: tax.amount,
        totalDiscount: data.totalDiscountAmount,
        discountType: data.discountType,
        discountAmount: data.totalDiscount,
        payableAmount: data.totalAmount,
        shippingCharge: data.shippingCharge,
        otherCharge: data.otherCharge,
        quotationableId: location?.id ?? null,
        quotationableType: location?.type ?? null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id));

    await tx
      .delete(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, id),
          eq(productItemDetails.itemableType, MorphType.Quotation),
        ),
      );

    for (const line of data.lines) {
      const lineTotal = line.price * line.quantity;
      const calculatedTax = (lineTotal * line.tax) / 100;
      const calculatedDiscount = (lineTotal * line.discount) / 100;

      await tx.insert(productItemDetails).values({
        itemableId: id,
        itemableType: MorphType.Quotation,
        productSkuId: line.productSkuId,
        price: line.price,
        quantity: line.quantity,
        tax: line.isCombo ? 0 : line.tax,
        discount: line.isCombo ? 0 : line.discount,
        subTotal: line.isCombo
          ? lineTotal
          : lineTotal + calculatedTax - calculatedDiscount,
        productableId: line.productableId,
        productableType: line.isCombo ? MorphType.ComboProduct : MorphType.ProductSku,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });
}

export async function deleteQuotation(id: number): Promise<void> {
  await runInTransaction(async (tx) => {
    await tx
      .delete(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, id),
          eq(productItemDetails.itemableType, MorphType.Quotation),
        ),
      );
    await tx.delete(quotations).where(eq(quotations.id, id));
  });
}
