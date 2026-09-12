// ---------------------------------------------------------------------------
// Sale writes - port of Modules/Sale/Repositories/SaleRepository.php.
//
// The lifecycle, and where the accounting happens:
//
//   create()        draft sale + line items + `sales` stock movements
//                   (no ledger entries yet; `is_approved` stays 0)
//   payments()      `payments` rows, and once approved a CV/BV receipt voucher
//   statusChange()  APPROVAL - deducts stock, posts the revenue journal, the
//                   cost-of-goods journal and a receipt voucher per payment,
//                   then settles any credit balance against open invoices
//   itemUpdate()    records a return request (`sales_return` movements)
//   returnApprove() puts the stock back and posts the return journals
// ---------------------------------------------------------------------------

import 'server-only';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import {
  comboProductDetails,
  comboProducts,
  contacts,
  partNumbers,
  payments,
  productItemDetailsPartNumbers,
  productItemDetails,
  productSku,
  products,
  quotations,
  sales,
  shippings,
  users,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import {
  MovementType,
  adjustStock,
  currentStock,
  deleteMovementsFor,
  parseLocation,
  recordMovement,
  type StockLocation,
} from '@/lib/inventory/stock';
import { createVoucher, VoucherType } from '@/lib/accounting/vouchers';
import { createJournalVoucher } from '@/lib/accounting/journal';
import {
  contactAccountId,
  defaultCostOfGoodsSoldAccountId,
  defaultProductTaxAccountId,
  defaultPurchaseAccountId,
  defaultSalesAccountId,
  defaultSalesReturnAccount,
  shippingOrOtherChargeIncomeId,
  taxAccountId,
} from '@/lib/accounting/defaults';
import { findContactAccount, accountBalance } from '@/lib/accounting/accounts';
import { VoucherApproval, voucherAutoApproved } from '@/lib/business-settings';
import { IntroPrefixId, introPrefixFor } from '@/lib/settings';
import { today, toDateString } from '@/lib/php-date';
import { SaleStatus, SaleReturnStatus, SaleKind } from './queries';
import { ProductType } from '@/lib/product/constants';

type Tx = MySql2Database<typeof schema>;

/** The PHP returned `1` from create()/update() to signal "not enough stock". */
export const INSUFFICIENT_STOCK = 1 as const;

export type SaleLineInput = {
  /** A ProductSku id, or a ComboProduct id when `isCombo`. */
  productableId: number;
  isCombo?: boolean;
  /** The SKU the line is stocked against (same as productableId for SKUs). */
  productSkuId: number;
  price: number;
  quantity: number;
  tax: number;
  discount: number;
  /** Serial numbers selected for this line. */
  partNumberIds?: number[];
};

export type SaleInput = {
  /** `"customer-12"` or `"agent-4"`, as the Blade select posted. */
  customerRef: string;
  /** `"showroom-1"` / `"warehouse-2"`. */
  locationRef: string;
  refNo?: string | null;
  invoiceNo?: string | null;
  date: string;
  notes?: string | null;
  saleType?: number;

  itemAmount: number;
  totalQuantity: number;
  /** Posted as `"<amount>-<tax_id>"`; a tax id of 0 means none. */
  totalTax: string;
  shippingCharge: number;
  otherCharge: number;
  totalDiscountAmount: number;
  discountType: number;
  totalDiscount: number;
  totalAmount: number;

  shippingName?: string | null;
  quotationId?: number | null;

  lines: SaleLineInput[];
};

function parseCustomerRef(ref: string): {
  customerId: number | null;
  agentUserId: number | null;
} {
  const [kind, rawId] = String(ref).split('-');
  const id = Number(rawId);
  if (!Number.isFinite(id)) return { customerId: null, agentUserId: null };
  return kind === 'agent'
    ? { customerId: null, agentUserId: id }
    : { customerId: id, agentUserId: null };
}

/** `explode('-', $data['total_tax'])` - "120.50-3" -> amount 120.50, tax id 3. */
function parseTotalTax(value: string): { amount: number; taxId: number | null } {
  const [rawAmount, rawId] = String(value).split('-');
  const amount = Number(rawAmount);
  const taxId = Number(rawId);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    taxId: Number.isFinite(taxId) && taxId !== 0 ? taxId : null,
  };
}

/** The SKUs a combo consumes, with their per-combo quantities. */
async function comboComponents(comboProductId: number, conn: Tx = db) {
  return conn
    .select({
      productSkuId: comboProductDetails.productSkuId,
      productQty: comboProductDetails.productQty,
    })
    .from(comboProductDetails)
    .where(eq(comboProductDetails.comboProductId, comboProductId));
}

/** Services are never stock-tracked. */
async function isServiceSku(productSkuId: number, conn: Tx = db): Promise<boolean> {
  const [row] = await conn
    .select({ productType: products.productType })
    .from(productSku)
    .innerJoin(products, eq(products.id, productSku.productId))
    .where(eq(productSku.id, productSkuId))
    .limit(1);
  return row?.productType === ProductType.Service;
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

/**
 * `SaleRepository::create($data)`.
 *
 * Returns the new sale id, or `INSUFFICIENT_STOCK` when a line exceeds the
 * stock on hand - the PHP deleted the half-built sale and returned 1.
 */
export async function createSale(
  data: SaleInput,
  userId: number,
): Promise<number | typeof INSUFFICIENT_STOCK> {
  const location = parseLocation(data.locationRef);
  if (!location) return INSUFFICIENT_STOCK;

  const { customerId, agentUserId } = parseCustomerRef(data.customerRef);
  const tax = parseTotalTax(data.totalTax);

  return runInTransaction(async (tx) => {
    const [inserted] = await tx.insert(sales).values({
      customerId,
      agentUserId,
      userId,
      saleableId: location.id,
      saleableType: location.type,
      refNo: data.refNo ?? null,
      invoiceNo: data.invoiceNo ?? null,
      date: toDateString(data.date) ?? today(),
      notes: data.notes ?? null,
      type: data.saleType ?? SaleKind.Regular,
      amount: data.itemAmount,
      totalQuantity: data.totalQuantity,
      totalTax: tax.amount,
      taxId: tax.taxId,
      shippingCharge: data.shippingCharge,
      otherCharge: data.otherCharge,
      totalDiscount: data.totalDiscountAmount,
      discountType: data.discountType,
      discountAmount: data.totalDiscount,
      payableAmount: data.totalAmount,
      isApproved: 0,
      status: SaleStatus.Unpaid,
      returnStatus: SaleReturnStatus.None,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saleId = Number(inserted.insertId);

    // `Sale::boot()` stamped the invoice number once the id existed.
    if (!data.invoiceNo) {
      const prefix = (await introPrefixFor(IntroPrefixId.SalesInvoice)) ?? 'INV';
      const now = new Date();
      const yy = String(now.getUTCFullYear()).slice(-2);
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      await tx
        .update(sales)
        .set({ invoiceNo: `${prefix}-${yy}${mm}${userId}${saleId}` })
        .where(eq(sales.id, saleId));
    }

    if (data.shippingName) {
      await tx.insert(shippings).values({
        saleId,
        shippingName: data.shippingName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Serial numbers chosen anywhere on the form are marked sold.
    const allPartNumbers = data.lines.flatMap((l) => l.partNumberIds ?? []);
    if (allPartNumbers.length) {
      await tx
        .update(partNumbers)
        .set({ isSold: 1, updatedAt: new Date() })
        .where(inArray(partNumbers.id, allPartNumbers));
    }

    for (const line of data.lines) {
      const ok = await addSaleLine(tx, saleId, location, line, userId);
      if (!ok) {
        // Mirror the PHP: abandon the whole sale.
        throw new InsufficientStockError();
      }
    }

    // Converting a quotation marks it converted.
    if (data.quotationId) {
      await tx
        .update(quotations)
        .set({ convertStatus: 1, updatedAt: new Date() })
        .where(eq(quotations.id, data.quotationId));
    }

    return saleId;
  }).catch((error) => {
    if (error instanceof InsufficientStockError) return INSUFFICIENT_STOCK;
    throw error;
  });
}

class InsufficientStockError extends Error {
  constructor() {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

/**
 * Write one line item plus its stock movement.
 * Returns false when the location does not hold enough stock.
 */
async function addSaleLine(
  tx: Tx,
  saleId: number,
  location: StockLocation,
  line: SaleLineInput,
  userId: number,
): Promise<boolean> {
  // The PHP computed: tax and discount are percentages of the line total.
  const lineTotal = line.price * line.quantity;
  const calculatedTax = (lineTotal * line.tax) / 100;
  const calculatedDiscount = (lineTotal * line.discount) / 100;
  const subTotal = lineTotal + calculatedTax - calculatedDiscount;

  if (line.isCombo) {
    // A combo consumes each component SKU by (line qty x component qty).
    const components = await comboComponents(line.productableId, tx);
    for (const component of components) {
      if (component.productSkuId == null || component.productQty == null) continue;
      const needed = line.quantity * component.productQty;
      const onHand = await currentStock(location, component.productSkuId, tx);
      if (onHand < needed) return false;

      await recordMovement(
        {
          type: MovementType.Sales,
          documentType: MorphType.Sale,
          documentId: saleId,
          location,
          productSkuId: component.productSkuId,
          quantity: needed,
          userId,
        },
        tx,
      );
    }

    const [row] = await tx.insert(productItemDetails).values({
      itemableId: saleId,
      itemableType: MorphType.Sale,
      productSkuId: line.productableId,
      price: line.price,
      quantity: line.quantity,
      subTotal: line.price * line.quantity,
      productableId: line.productableId,
      productableType: MorphType.ComboProduct,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await attachPartNumbers(tx, saleId, Number(row.insertId), line);
    return true;
  }

  const service = await isServiceSku(line.productSkuId, tx);

  if (!service) {
    const onHand = await currentStock(location, line.productSkuId, tx);
    if (onHand < line.quantity) return false;
  }

  const [row] = await tx.insert(productItemDetails).values({
    itemableId: saleId,
    itemableType: MorphType.Sale,
    productSkuId: line.productSkuId,
    price: line.price,
    quantity: line.quantity,
    tax: line.tax,
    discount: line.discount,
    subTotal,
    productableId: line.productableId,
    productableType: MorphType.ProductSku,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await attachPartNumbers(tx, saleId, Number(row.insertId), line);

  if (!service) {
    await recordMovement(
      {
        type: MovementType.Sales,
        documentType: MorphType.Sale,
        documentId: saleId,
        location,
        productSkuId: line.productSkuId,
        quantity: line.quantity,
        userId,
      },
      tx,
    );
  }

  return true;
}

async function attachPartNumbers(
  tx: Tx,
  saleId: number,
  itemDetailId: number,
  line: SaleLineInput,
) {
  if (!line.partNumberIds?.length) return;
  await tx.insert(productItemDetailsPartNumbers).values(
    line.partNumberIds.map((partNumberId) => ({
      partNumberId,
      saleId,
      productSkuId: line.productSkuId,
      productItemDetailId: itemDetailId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

/**
 * `SaleRepository::update($data, $id)`.
 *
 * The PHP deleted every product history for the sale up front, then updated the
 * lines that were already on it and appended the newly added ones, re-recording
 * a movement for each. Its stock check compared the *delta* for an existing line
 * and the full quantity for a new one; both are kept here.
 *
 * The edit form posts one uniform line list, so a line that is no longer present
 * is removed - the end state is the same set of rows the PHP arrived at.
 */
export async function updateSale(
  id: number,
  data: SaleInput,
  userId: number,
): Promise<number | typeof INSUFFICIENT_STOCK> {
  const location = parseLocation(data.locationRef);
  if (!location) return INSUFFICIENT_STOCK;

  const { customerId, agentUserId } = parseCustomerRef(data.customerRef);
  const tax = parseTotalTax(data.totalTax);

  return runInTransaction(async (tx) => {
    const [sale] = await tx.select().from(sales).where(eq(sales.id, id)).limit(1);
    if (!sale) throw new InsufficientStockError();

    await tx
      .update(sales)
      .set({
        customerId,
        agentUserId,
        userId,
        saleableId: location.id,
        saleableType: location.type,
        refNo: data.refNo ?? null,
        date: toDateString(data.date) ?? today(),
        notes: data.notes ?? null,
        amount: data.itemAmount,
        totalQuantity: data.totalQuantity,
        totalDiscount: data.totalDiscountAmount,
        discountType: data.discountType,
        discountAmount: data.totalDiscount,
        payableAmount: data.totalAmount,
        shippingCharge: data.shippingCharge,
        otherCharge: data.otherCharge,
        totalTax: tax.amount,
        taxId: tax.taxId,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, id));

    // `foreach ($sale->houses as $productHistory) { $productHistory->delete(); }`
    await deleteMovementsFor(MorphType.Sale, id, tx);

    const existing = await tx
      .select()
      .from(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, id),
          eq(productItemDetails.itemableType, MorphType.Sale),
        ),
      );

    const keyOf = (productableId: number, isCombo: boolean) =>
      `${isCombo ? 'combo' : 'sku'}-${productableId}`;

    const existingByKey = new Map(
      existing.map((item) => [
        keyOf(
          item.productableId ?? item.productSkuId,
          item.productableType === MorphType.ComboProduct,
        ),
        item,
      ]),
    );

    const seen = new Set<string>();

    for (const line of data.lines) {
      const key = keyOf(line.productableId, Boolean(line.isCombo));
      seen.add(key);
      const current = existingByKey.get(key);

      if (!current) {
        // A line added during the edit - checked against the full quantity.
        const ok = await addSaleLine(tx, id, location, line, userId);
        if (!ok) throw new InsufficientStockError();
        continue;
      }

      // Serial numbers are re-attached from scratch, as the PHP did.
      await tx
        .delete(productItemDetailsPartNumbers)
        .where(eq(productItemDetailsPartNumbers.productItemDetailId, current.id));
      await attachPartNumbers(tx, id, current.id, line);

      const lineTotal = line.price * line.quantity;
      const calculatedTax = (lineTotal * line.tax) / 100;
      const subTotal = line.isCombo
        ? lineTotal
        : lineTotal + calculatedTax - line.discount;

      await tx
        .update(productItemDetails)
        .set({
          price: line.price,
          quantity: line.quantity,
          tax: line.isCombo ? current.tax : line.tax,
          discount: line.isCombo ? current.discount : line.discount,
          subTotal,
          productableId: line.productableId,
          productableType: line.isCombo ? MorphType.ComboProduct : MorphType.ProductSku,
          updatedAt: new Date(),
        })
        .where(eq(productItemDetails.id, current.id));

      // `$decreaseQuantity = $new - $old` - only the extra has to be in stock.
      const delta = line.quantity - current.quantity;

      if (line.isCombo) {
        const components = await comboComponents(line.productableId, tx);
        for (const component of components) {
          if (component.productSkuId == null || component.productQty == null) continue;
          if (delta > 0) {
            const onHand = await currentStock(location, component.productSkuId, tx);
            if (onHand < delta * component.productQty) throw new InsufficientStockError();
          }
        }

        await recordMovement(
          {
            type: MovementType.Sales,
            documentType: MorphType.Sale,
            documentId: id,
            location,
            productSkuId: line.productSkuId,
            quantity: line.quantity,
            userId,
          },
          tx,
        );
        continue;
      }

      const service = await isServiceSku(line.productSkuId, tx);
      if (!service) {
        if (delta > 0) {
          const onHand = await currentStock(location, line.productSkuId, tx);
          if (onHand < delta) throw new InsufficientStockError();
        }

        await recordMovement(
          {
            type: MovementType.Sales,
            documentType: MorphType.Sale,
            documentId: id,
            location,
            productSkuId: line.productSkuId,
            quantity: line.quantity,
            userId,
          },
          tx,
        );
      }
    }

    // Lines dropped on the edit screen go away with their serial numbers.
    for (const [key, item] of existingByKey) {
      if (seen.has(key)) continue;
      await tx
        .delete(productItemDetailsPartNumbers)
        .where(eq(productItemDetailsPartNumbers.productItemDetailId, item.id));
      await tx.delete(productItemDetails).where(eq(productItemDetails.id, item.id));
    }

    // Serial numbers selected anywhere on the form are marked sold.
    const allPartNumbers = data.lines.flatMap((l) => l.partNumberIds ?? []);
    if (allPartNumbers.length) {
      await tx
        .update(partNumbers)
        .set({ isSold: 1, updatedAt: new Date() })
        .where(inArray(partNumbers.id, allPartNumbers));
    }

    return id;
  }).catch((error) => {
    if (error instanceof InsufficientStockError) return INSUFFICIENT_STOCK;
    throw error;
  });
}

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

/**
 * `SaleRepository::delete($id)` - puts the stock back and removes the sale.
 * Only meaningful for a sale that was approved (and so had stock deducted).
 */
export async function deleteSale(id: number): Promise<void> {
  const [sale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  if (!sale || !sale.saleableId) return;

  const location: StockLocation = {
    id: sale.saleableId,
    type:
      sale.saleableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  await runInTransaction(async (tx) => {
    const items = await tx
      .select()
      .from(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, id),
          eq(productItemDetails.itemableType, MorphType.Sale),
        ),
      );

    for (const item of items) {
      if (item.productableType === MorphType.ComboProduct && item.productableId) {
        const components = await comboComponents(item.productableId, tx);
        for (const component of components) {
          if (component.productSkuId == null || component.productQty == null) continue;
          await adjustStock(
            location,
            component.productSkuId,
            item.quantity * component.productQty,
            tx,
          );
        }
      } else if (!(await isServiceSku(item.productSkuId, tx))) {
        await adjustStock(
          location,
          item.productSkuId,
          item.quantity - item.returnQuantity,
          tx,
        );
      }
    }

    await deleteMovementsFor(MorphType.Sale, id, tx);
    await tx
      .delete(productItemDetailsPartNumbers)
      .where(eq(productItemDetailsPartNumbers.saleId, id));
    await tx
      .delete(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, id),
          eq(productItemDetails.itemableType, MorphType.Sale),
        ),
      );
    await tx
      .delete(payments)
      .where(and(eq(payments.payableId, id), eq(payments.payableType, MorphType.Sale)));
    await tx.delete(sales).where(eq(sales.id, id));
  });
}

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------

export type PaymentInput = {
  paymentMethod: string;
  amount: number;
  /** Bank account (a ChartAccount id) for non-cash methods. */
  accountId?: number | null;
  bankName?: string | null;
  branch?: string | null;
  accountNo?: string | null;
  accountOwner?: string | null;
};

/**
 * `SaleRepository::payments($payments, $id, $initial_payment)`.
 *
 * Anything beyond the outstanding balance is banked as `advance_amount`. A
 * receipt voucher is only raised once the sale is approved.
 */
export async function recordSalePayments(
  saleId: number,
  paymentInputs: PaymentInput[],
  userId: number,
  initialPayment = false,
): Promise<void> {
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale) return;

  const [paidRow] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.payableId, saleId), eq(payments.payableType, MorphType.Sale)));

  const paidBefore = Number(paidRow?.paid ?? 0);
  const payable = Number(sale.payableAmount);

  let dueAmount = payable - paidBefore;
  let paidNow = 0;

  const autoApprove = (await voucherAutoApproved(VoucherApproval.Sale)) ? 1 : 0;
  const customerAccount = await saleContactAccountId(sale);

  await runInTransaction(async (tx) => {
    for (const payment of paymentInputs) {
      paidNow += payment.amount;

      // Split the payment into the part that settles the invoice and the
      // surplus, exactly as the PHP did.
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
        payableId: saleId,
        payableType: MorphType.Sale,
        paymentMethod: payment.paymentMethod,
        initialPayment: initialPayment ? 1 : 0,
        amount,
        advanceAmount,
        accountId: payment.accountId ?? null,
        bankName: payment.bankName ?? null,
        branch: payment.branch ?? null,
        accountNo: payment.accountNo ?? null,
        accountOwner: payment.accountOwner ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // A receipt voucher is only posted for an approved sale.
      if (sale.isApproved !== 0 && customerAccount) {
        const isCash =
          payment.paymentMethod === 'cash' || payment.paymentMethod === 'quick cash';

        const debitAccountId = isCash
          ? await locationCashAccountId(sale)
          : (payment.accountId ?? null);

        if (debitAccountId) {
          const txAmount = dueAmount <= payment.amount ? dueAmount : payment.amount;
          const voucherAmount =
            payable <= payment.amount ? payable : payment.amount;

          await createVoucher(
            {
              voucherType: isCash ? VoucherType.Cash : VoucherType.Bank,
              amount: voucherAmount,
              date: today(),
              paymentType: 'voucher_recieve',
              creditAccountId: customerAccount,
              creditAccountAmount: voucherAmount,
              creditAccountNarration: [`Payment recieved by${payment.paymentMethod}`],
              debitAccountId,
              debitAccountAmount: txAmount,
              debitAccountNarration: [`Sales ${payment.paymentMethod}`],
              narration: `Payment recieved by${payment.paymentMethod}`,
              bankName: isCash ? null : (payment.bankName ?? null),
              bankBranch: isCash ? null : (payment.branch ?? null),
              referableId: saleId,
              referableType: MorphType.Sale,
              isApprove: autoApprove,
              createdBy: userId,
            },
            tx,
          );
        }
      }

      dueAmount -= payment.amount;
    }

    // Settle the invoice status.
    const totalPaid = paidBefore + paidNow;
    let status = sale.status;
    if (payable <= totalPaid) {
      // Overpayment on a quick-cash sale is recorded as change given back.
      await tx
        .update(payments)
        .set({ returnAmount: totalPaid - payable })
        .where(
          and(
            eq(payments.payableId, saleId),
            eq(payments.payableType, MorphType.Sale),
            eq(payments.paymentMethod, 'quick cash'),
          ),
        );
      status = SaleStatus.Paid;
    } else if (payable > totalPaid && totalPaid > 0) {
      status = SaleStatus.Partial;
    }

    await tx
      .update(sales)
      .set({ status, updatedBy: userId, updatedAt: new Date() })
      .where(eq(sales.id, saleId));
  });
}

/** The customer's or agent's ledger account. */
async function saleContactAccountId(
  sale: Pick<typeof sales.$inferSelect, 'customerId' | 'agentUserId'>,
): Promise<number | null> {
  if (sale.customerId) {
    return contactAccountId(sale.customerId, MorphType.ContactModel);
  }
  if (sale.agentUserId) {
    return contactAccountId(sale.agentUserId, MorphType.User);
  }
  return null;
}

/** `GetAccountId($sale->saleable_id, $sale->saleable_type)` - the branch's cash account. */
async function locationCashAccountId(
  sale: Pick<typeof sales.$inferSelect, 'saleableId' | 'saleableType'>,
): Promise<number | null> {
  if (!sale.saleableId || !sale.saleableType) return null;
  const account = await findContactAccount(sale.saleableId, sale.saleableType);
  return account?.id ?? null;
}

// ---------------------------------------------------------------------------
// approval
// ---------------------------------------------------------------------------

/**
 * `SaleRepository::statusChange($id)` - approve a sale.
 *
 * Deducts stock, then posts three sets of entries:
 *   1. a revenue journal: customer Dr, sales / tax / shipping Cr
 *   2. a cost-of-goods journal: COGS Dr against the inventory account
 *   3. a receipt voucher for each payment already taken
 * and finally applies any credit balance to the customer's open invoices.
 */
export async function approveSale(saleId: number, userId: number): Promise<void> {
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale || !sale.saleableId) return;

  const location: StockLocation = {
    id: sale.saleableId,
    type:
      sale.saleableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  const customerAccount = await saleContactAccountId(sale);
  if (!customerAccount) return;

  const autoApprove = (await voucherAutoApproved(VoucherApproval.Sale)) ? 1 : 0;

  // Account ids used by the journals.
  const [
    salesAccount,
    productTaxAccount,
    shippingIncomeAccount,
    cogsAccount,
    purchaseAccount,
  ] = await Promise.all([
    defaultSalesAccountId(),
    defaultProductTaxAccountId(),
    shippingOrOtherChargeIncomeId(),
    defaultCostOfGoodsSoldAccountId(),
    defaultPurchaseAccountId(),
  ]);

  const saleTaxAccount = sale.taxId ? await taxAccountId(sale.taxId) : null;

  await runInTransaction(async (tx) => {
    // Mark the sale's serial numbers sold.
    const serials = await tx
      .select({ partNumberId: productItemDetailsPartNumbers.partNumberId })
      .from(productItemDetailsPartNumbers)
      .where(eq(productItemDetailsPartNumbers.saleId, saleId));
    const serialIds = serials
      .map((s) => s.partNumberId)
      .filter((v): v is number => v != null);
    if (serialIds.length) {
      await tx
        .update(partNumbers)
        .set({ isSold: 1, updatedAt: new Date() })
        .where(inArray(partNumbers.id, serialIds));
    }

    const items = await tx
      .select()
      .from(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, saleId),
          eq(productItemDetails.itemableType, MorphType.Sale),
        ),
      );

    let taxAccountAmount = 0;
    let purchaseAmount = 0;

    for (const item of items) {
      if (item.productableType === MorphType.ComboProduct && item.productableId) {
        const components = await comboComponents(item.productableId, tx);
        for (const component of components) {
          if (component.productSkuId == null || component.productQty == null) continue;
          await adjustStock(
            location,
            component.productSkuId,
            -(item.quantity * component.productQty),
            tx,
          );
        }

        const [combo] = await tx
          .select({ totalPurchasePrice: comboProducts.totalPurchasePrice })
          .from(comboProducts)
          .where(eq(comboProducts.id, item.productableId))
          .limit(1);
        purchaseAmount += Number(combo?.totalPurchasePrice ?? 0) * item.quantity;
      } else {
        if (!(await isServiceSku(item.productSkuId, tx))) {
          // The PHP subtracted quantity AND return_quantity here.
          await adjustStock(
            location,
            item.productSkuId,
            -(item.quantity + item.returnQuantity),
            tx,
          );
        }

        const [sku] = await tx
          .select({ costOfGoods: productSku.costOfGoods })
          .from(productSku)
          .where(eq(productSku.id, item.productSkuId))
          .limit(1);
        purchaseAmount += Number(sku?.costOfGoods ?? 0) * item.quantity;
      }

      taxAccountAmount +=
        ((Number(item.price) - Number(item.discount)) * item.quantity * Number(item.tax)) /
        100;
    }

    // --- Revenue journal -------------------------------------------------
    // The PHP built these arrays then reversed them before posting.
    const subAccountIds: number[] = [];
    const subAmounts: number[] = [];
    const subNarrations: string[] = [];

    subAccountIds.push(salesAccount);
    subAmounts.push(Number(sale.amount) - taxAccountAmount);
    subNarrations.push('Product Sales');

    if (taxAccountAmount > 0) {
      subAccountIds.push(productTaxAccount);
      subAmounts.push(taxAccountAmount);
      subNarrations.push('Product Sale Tax');
    }

    if (sale.taxId && saleTaxAccount) {
      subAccountIds.push(saleTaxAccount);
      subAmounts.push(
        ((Number(sale.amount) - Number(sale.totalDiscount)) * Number(sale.totalTax)) / 100,
      );
      subNarrations.push('Tax on Sale');
    }

    const charges = Number(sale.shippingCharge) + Number(sale.otherCharge);
    if (charges > 0) {
      subAccountIds.push(shippingIncomeAccount);
      subAmounts.push(charges);
      subNarrations.push('Sales Income (Shipping and others charge)');
    }

    await createJournalVoucher(
      {
        amount: Number(sale.payableAmount),
        date: today(),
        accountType: 'debit',
        accountId: customerAccount,
        mainAmount: Number(sale.payableAmount),
        narration: 'Product Sales',
        subAccountId: [...subAccountIds].reverse(),
        subAmount: [...subAmounts].reverse(),
        subNarration: [...subNarrations].reverse(),
        referableId: saleId,
        referableType: MorphType.Sale,
        isApprove: autoApprove,
        createdBy: userId,
      },
      tx,
    );

    // --- Cost of goods journal -------------------------------------------
    await createJournalVoucher(
      {
        amount: purchaseAmount,
        date: today(),
        accountType: 'credit',
        accountId: purchaseAccount,
        mainAmount: purchaseAmount,
        narration: 'Inventory deduct for sales purpose',
        subAccountId: [cogsAccount],
        subAmount: [purchaseAmount],
        subNarration: ['Cost of goods sold to customer/Retailer'],
        referableId: saleId,
        referableType: MorphType.Sale,
        isApprove: autoApprove,
        createdBy: userId,
      },
      tx,
    );

    // --- Receipt vouchers for payments already taken ----------------------
    const paymentRows = await tx
      .select()
      .from(payments)
      .where(
        and(eq(payments.payableId, saleId), eq(payments.payableType, MorphType.Sale)),
      );

    for (const payment of paymentRows) {
      const isCash =
        payment.paymentMethod === 'cash' || payment.paymentMethod === 'quick cash';
      const debitAccountId = isCash
        ? await locationCashAccountId(sale)
        : (payment.accountId ?? null);
      if (!debitAccountId) continue;

      const amount =
        Number(payment.amount) + Number(payment.advanceAmount) - Number(payment.returnAmount);

      await createVoucher(
        {
          voucherType: isCash ? VoucherType.Cash : VoucherType.Bank,
          amount,
          date: today(),
          paymentType: 'voucher_recieve',
          creditAccountId: customerAccount,
          creditAccountAmount: amount,
          creditAccountNarration: [`Payment recieved by ${payment.paymentMethod}`],
          debitAccountId,
          debitAccountAmount: amount,
          debitAccountNarration: ['Product Sales'],
          narration: `Payment recieved by ${payment.paymentMethod}`,
          bankName: isCash ? null : payment.bankName,
          bankBranch: isCash ? null : payment.branch,
          referableId: saleId,
          referableType: MorphType.Sale,
          isApprove: autoApprove,
          createdBy: userId,
        },
        tx,
      );
    }

    await tx
      .update(sales)
      .set({ isApproved: 1, updatedBy: userId, updatedAt: new Date() })
      .where(eq(sales.id, saleId));
  });

  // A customer in credit has the surplus applied to their open invoices.
  await settleCreditBalance(sale, customerAccount, saleId);
}

/**
 * The tail of `statusChange()`: when the contact's ledger balance is negative
 * (they are in credit), the surplus is applied to their unpaid invoices as
 * "Adjustment Balance" payments.
 */
async function settleCreditBalance(
  sale: typeof sales.$inferSelect,
  customerAccountId: number,
  currentSaleId: number,
): Promise<void> {
  const [account] = await db
    .select({ id: schema.chartAccounts.id, type: schema.chartAccounts.type })
    .from(schema.chartAccounts)
    .where(eq(schema.chartAccounts.id, customerAccountId))
    .limit(1);
  if (!account) return;

  const balance = await accountBalance(account);
  if (balance >= 0) return;

  let extra = Math.abs(balance);

  const openInvoices = await db
    .select()
    .from(sales)
    .where(
      and(
        sale.customerId
          ? eq(sales.customerId, sale.customerId)
          : eq(sales.agentUserId, sale.agentUserId!),
        ne(sales.status, SaleStatus.Paid),
        eq(sales.isApproved, 1),
      ),
    )
    .orderBy(sales.id);

  for (const invoice of openInvoices) {
    if (extra <= 0) break;

    const [paidRow] = await db
      .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.payableId, invoice.id),
          eq(payments.payableType, MorphType.Sale),
        ),
      );

    const due = Number(invoice.payableAmount) - Number(paidRow?.paid ?? 0);
    if (due <= 0) continue;

    const applied = extra >= due ? due : extra;

    await db.insert(payments).values({
      payableId: invoice.id,
      payableType: MorphType.Sale,
      paymentMethod: 'Adjustment Balance',
      amount: applied,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db
      .update(sales)
      .set({
        status: extra >= due ? SaleStatus.Paid : SaleStatus.Partial,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, invoice.id));

    extra -= due;
  }

  void currentSaleId;
}

// ---------------------------------------------------------------------------
// returns
// ---------------------------------------------------------------------------

export type SaleReturnLine = {
  itemId: number;
  quantity: number;
};

/**
 * `SaleRepository::itemUpdate($data, $item, $id)` - record a return request.
 * Stock is not moved yet; `returnApprove()` does that.
 */
export async function recordSaleReturn(
  saleId: number,
  lines: SaleReturnLine[],
  userId: number,
  options: { returnNote?: string | null; returnedPartNumberIds?: number[] } = {},
): Promise<void> {
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale || !sale.saleableId) return;

  const location: StockLocation = {
    id: sale.saleableId,
    type:
      sale.saleableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  await runInTransaction(async (tx) => {
    await tx
      .update(sales)
      .set({
        returnStatus: SaleReturnStatus.Pending,
        returnNote: options.returnNote ?? null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId));

    if (options.returnedPartNumberIds?.length) {
      // The PHP set `is_returned` on the JOIN row
      // (`product_item_details_part_numbers`), but that table has no such
      // column - only `part_numbers` does, so that write could only fail.
      // The flag is set on `part_numbers`, which is what the return approval
      // reads back.
      await tx
        .update(partNumbers)
        .set({ isReturned: 1, updatedAt: new Date() })
        .where(inArray(partNumbers.id, options.returnedPartNumberIds));
    }

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

      if (!(await isServiceSku(item.productSkuId, tx)) && line.quantity > 0) {
        await recordMovement(
          {
            type: MovementType.SalesReturn,
            documentType: MorphType.Sale,
            documentId: saleId,
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

  // `sale_return_approval` auto-approves the return when switched on.
  if (await voucherAutoApproved(VoucherApproval.SaleReturn)) {
    await approveSaleReturn(saleId, userId);
  }
}

/**
 * `SaleRepository::returnApprove($id)` - accept the return.
 * Puts the stock back, releases the serial numbers and posts the return
 * journals (sales return, and the cost-of-goods reversal).
 */
export async function approveSaleReturn(saleId: number, userId: number): Promise<void> {
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale || !sale.saleableId) return;

  const location: StockLocation = {
    id: sale.saleableId,
    type:
      sale.saleableType === MorphType.WareHouse
        ? MorphType.WareHouse
        : MorphType.ShowRoom,
  };

  const customerAccount = await saleContactAccountId(sale);
  const salesReturnAccount = await defaultSalesReturnAccount();
  const [cogsAccount, purchaseAccount] = await Promise.all([
    defaultCostOfGoodsSoldAccountId(),
    defaultPurchaseAccountId(),
  ]);

  const autoApprove = (await voucherAutoApproved(VoucherApproval.SaleReturn)) ? 1 : 0;

  await runInTransaction(async (tx) => {
    // Returned serials go back on the shelf. The flag lives on `part_numbers`
    // (see the note in `recordSaleReturn`), so the join table is used only to
    // scope the serials to this sale.
    const returned = await tx
      .select({
        linkId: productItemDetailsPartNumbers.id,
        partNumberId: productItemDetailsPartNumbers.partNumberId,
      })
      .from(productItemDetailsPartNumbers)
      .innerJoin(
        partNumbers,
        eq(partNumbers.id, productItemDetailsPartNumbers.partNumberId),
      )
      .where(
        and(
          eq(productItemDetailsPartNumbers.saleId, saleId),
          eq(partNumbers.isReturned, 1),
        ),
      );

    const returnedIds = returned
      .map((r) => r.partNumberId)
      .filter((v): v is number => v != null);
    if (returnedIds.length) {
      await tx
        .update(partNumbers)
        .set({ isSold: 0, updatedAt: new Date() })
        .where(inArray(partNumbers.id, returnedIds));
      await tx
        .delete(productItemDetailsPartNumbers)
        .where(
          inArray(
            productItemDetailsPartNumbers.id,
            returned.map((r) => r.linkId),
          ),
        );
    }

    const items = await tx
      .select()
      .from(productItemDetails)
      .where(
        and(
          eq(productItemDetails.itemableId, saleId),
          eq(productItemDetails.itemableType, MorphType.Sale),
        ),
      );

    let purchaseAmount = 0;
    let totalReturnAmount = 0;

    for (const item of items) {
      totalReturnAmount += Number(item.returnAmount);

      if (item.returnQuantity > 0 && !(await isServiceSku(item.productSkuId, tx))) {
        await adjustStock(location, item.productSkuId, item.returnQuantity, tx);
      }

      if (item.productableType === MorphType.ComboProduct && item.productableId) {
        const [combo] = await tx
          .select({ totalPurchasePrice: comboProducts.totalPurchasePrice })
          .from(comboProducts)
          .where(eq(comboProducts.id, item.productableId))
          .limit(1);
        purchaseAmount += Number(combo?.totalPurchasePrice ?? 0) * item.returnQuantity;
      } else {
        const [sku] = await tx
          .select({ purchasePrice: productSku.purchasePrice })
          .from(productSku)
          .where(eq(productSku.id, item.productSkuId))
          .limit(1);
        purchaseAmount += Number(sku?.purchasePrice ?? 0) * item.returnQuantity;
      }
    }

    // --- Sales return journal --------------------------------------------
    if (totalReturnAmount > 0 && customerAccount) {
      await createJournalVoucher(
        {
          amount: totalReturnAmount,
          date: today(),
          accountType: 'debit',
          accountId: salesReturnAccount.id,
          mainAmount: totalReturnAmount,
          narration: 'Sales Return Account',
          subAccountId: [customerAccount],
          subAmount: [totalReturnAmount],
          subNarration: ['Sales Return Supplier Account'],
          referableId: saleId,
          referableType: MorphType.Sale,
          isApprove: autoApprove,
          createdBy: userId,
        },
        tx,
      );
    }

    // --- Cost of goods reversal ------------------------------------------
    await createJournalVoucher(
      {
        amount: purchaseAmount,
        date: today(),
        accountType: 'debit',
        accountId: purchaseAccount,
        mainAmount: purchaseAmount,
        narration: 'Inventory deduct for sales return purpose',
        subAccountId: [cogsAccount],
        subAmount: [purchaseAmount],
        subNarration: ['Cost of goods sold return to customer/Retailer'],
        referableId: saleId,
        referableType: MorphType.Sale,
        isApprove: autoApprove,
        createdBy: userId,
      },
      tx,
    );

    await tx
      .update(sales)
      .set({
        returnStatus: SaleReturnStatus.Accepted,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId));
  });
}

/** `acceptOrder($data)` - records who took delivery. */
export async function acceptSaleDelivery(
  saleId: number,
  receivedBy: string,
  deliveryDate: string,
): Promise<void> {
  const [shipping] = await db
    .select()
    .from(shippings)
    .where(eq(shippings.saleId, saleId))
    .orderBy(sql`${shippings.id} desc`)
    .limit(1);
  if (!shipping) return;

  await db
    .update(shippings)
    .set({
      receivedBy,
      receivedDate: toDateString(deliveryDate),
      updatedAt: new Date(),
    })
    .where(eq(shippings.id, shipping.id));
}

/** `storeShipping($data)` */
export async function saveShipping(data: {
  id?: number | null;
  saleId: number;
  shippingName?: string | null;
  shippingRef?: string | null;
  date?: string | null;
  receivedDate?: string | null;
  receivedBy?: string | null;
  bookingSlip?: string | null;
  proveOfDelivery?: string | null;
}): Promise<void> {
  const values = {
    saleId: data.saleId,
    shippingName: data.shippingName ?? null,
    shippingRef: data.shippingRef ?? null,
    date: toDateString(data.date) ?? null,
    receivedDate: data.receivedDate ? toDateString(data.receivedDate) : null,
    receivedBy: data.receivedBy ?? null,
    bookingSlip: data.bookingSlip ?? '',
    proveOfDelivery: data.proveOfDelivery ?? '',
    updatedAt: new Date(),
  };

  if (data.id) {
    await db.update(shippings).set(values).where(eq(shippings.id, data.id));
    return;
  }
  await db.insert(shippings).values({ ...values, createdAt: new Date() });
}

/** `quotationToSale($data)` - convert an approved quotation into a sale. */
export async function quotationToSale(
  quotationId: number,
  userId: number,
): Promise<number | null> {
  const [quotation] = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, quotationId))
    .limit(1);
  if (!quotation) return null;

  return runInTransaction(async (tx) => {
    const [firstShowroom] = await tx
      .select({ id: schema.showRooms.id })
      .from(schema.showRooms)
      .orderBy(schema.showRooms.id)
      .limit(1);

    const [inserted] = await tx.insert(sales).values({
      customerId: quotation.customerId,
      userId: quotation.userId ?? userId,
      saleableId: quotation.quotationableId ?? firstShowroom?.id ?? 1,
      saleableType: quotation.quotationableType ?? MorphType.ShowRoom,
      amount: quotation.amount,
      totalQuantity: quotation.totalQuantity,
      totalDiscount: quotation.totalDiscount,
      totalTax: quotation.totalVat,
      payableAmount: quotation.payableAmount,
      refNo: quotation.refNo,
      status: quotation.status ?? SaleStatus.Unpaid,
      type: SaleKind.Regular,
      isApproved: 0,
      date: toDateString(quotation.date) ?? today(),
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saleId = Number(inserted.insertId);

    // The quotation's line items are re-pointed at the new sale.
    await tx
      .update(productItemDetails)
      .set({ itemableId: saleId, itemableType: MorphType.Sale, updatedAt: new Date() })
      .where(
        and(
          eq(productItemDetails.itemableId, quotationId),
          eq(productItemDetails.itemableType, MorphType.Quotation),
        ),
      );

    return saleId;
  });
}

export { parseCustomerRef, parseTotalTax };
