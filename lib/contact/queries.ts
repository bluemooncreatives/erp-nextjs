// ---------------------------------------------------------------------------
// Contacts - port of Modules/Contact/Entities/ContactModel.php and
// Modules/Contact/Repositories/ContactRepository.php.
//
// One table holds both sides of the ledger, split by `contact_type`:
//   'Customer' -> has sales
//   'Supplier' -> has purchase orders
//
// `opening_balance` and `credit_limit` are VARCHAR in the original schema, so
// they are parsed on read.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  chartAccounts,
  comboProducts,
  contacts,
  countries,
  payments,
  productItemDetails,
  productSku,
  products,
  purchaseOrders,
  sales,
  transactions,
  vouchers,
  type ContactsRow,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { accountBalance } from '@/lib/accounting/accounts';

export const ContactType = {
  Customer: 'Customer',
  Supplier: 'Supplier',
} as const;

/** The seeded walk-in customer, excluded by `scopeWitoutWalkInCustomer`. */
export const WALK_IN_CUSTOMER_ID = 1;

export function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type ContactListFilters = {
  type?: 'Customer' | 'Supplier';
  search?: string;
  page?: number;
  perPage?: number;
};

export async function listContacts(filters: ContactListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? 25;

  const where: SQL[] = [];
  if (filters.type) where.push(eq(contacts.contactType, filters.type));
  if (filters.search) {
    const term = `%${filters.search}%`;
    where.push(
      or(
        like(contacts.name, term),
        like(contacts.businessName, term),
        like(contacts.email, term),
        like(contacts.mobile, term),
        like(contacts.contactId, term),
      )!,
    );
  }

  const condition = where.length ? and(...where) : undefined;

  const rows = await db
    .select({
      c: contacts,
      countryName: countries.name,
    })
    .from(contacts)
    .leftJoin(countries, eq(countries.id, contacts.countryId))
    .where(condition)
    .orderBy(desc(contacts.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(condition);

  return {
    rows: rows.map((r) => ({ ...r.c, countryName: r.countryName })),
    total: Number(countRow?.count ?? 0),
    page,
    perPage,
  };
}

export async function findContact(id: number): Promise<ContactsRow | null> {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return row ?? null;
}

/** `scopeCustomer` / `scopeSupplier` - option lists for the document forms. */
export async function customerOptions(includeWalkIn = true) {
  const where = includeWalkIn
    ? and(eq(contacts.contactType, ContactType.Customer), eq(contacts.isActive, 1))
    : and(
        eq(contacts.contactType, ContactType.Customer),
        eq(contacts.isActive, 1),
        ne(contacts.id, WALK_IN_CUSTOMER_ID),
      );

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      businessName: contacts.businessName,
      mobile: contacts.mobile,
      contactId: contacts.contactId,
    })
    .from(contacts)
    .where(where)
    .orderBy(contacts.name);
}

export async function supplierOptions() {
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      businessName: contacts.businessName,
      mobile: contacts.mobile,
      contactId: contacts.contactId,
    })
    .from(contacts)
    .where(and(eq(contacts.contactType, ContactType.Supplier), eq(contacts.isActive, 1)))
    .orderBy(contacts.name);
}

/**
 * `getAccountsAttribute()` - the totals every contact screen shows.
 *
 * Note the PHP's own definition, kept as-is:
 *   total = payable + opening_balance - returns
 *   paid  = sum(payments.amount) - sum(payments.return_amount)
 *   due   = chart account balance + opening_balance   (NOT total - paid)
 */
export type ContactAccounts = {
  total: number;
  paid: number;
  due: number;
  totalInvoice: number;
  dueInvoice: number;
};

export async function contactAccounts(contact: ContactsRow): Promise<ContactAccounts> {
  const openingBalance = toNumber(contact.openingBalance);

  const [account] = await db
    .select({ id: chartAccounts.id, type: chartAccounts.type })
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.contactableType, MorphType.ContactModel),
        eq(chartAccounts.contactableId, contact.id),
      ),
    )
    .limit(1);

  const balance = account ? await accountBalance(account) : 0;

  if (contact.contactType === ContactType.Customer) {
    const [totals] = await db
      .select({
        payable: sql<number>`coalesce(sum(${sales.payableAmount}), 0)`,
        count: sql<number>`count(*)`,
        dueCount: sql<number>`coalesce(sum(case when ${sales.status} <> 1 then 1 else 0 end), 0)`,
      })
      .from(sales)
      .where(eq(sales.customerId, contact.id));

    const [paidRow] = await db
      .select({
        paid: sql<number>`coalesce(sum(${payments.amount} - ${payments.returnAmount}), 0)`,
      })
      .from(payments)
      .innerJoin(
        sales,
        and(eq(sales.id, payments.payableId), eq(payments.payableType, MorphType.Sale)),
      )
      .where(eq(sales.customerId, contact.id));

    const [returnRow] = await db
      .select({
        returned: sql<number>`coalesce(sum(${productItemDetails.returnAmount}), 0)`,
      })
      .from(productItemDetails)
      .innerJoin(
        sales,
        and(
          eq(sales.id, productItemDetails.itemableId),
          eq(productItemDetails.itemableType, MorphType.Sale),
        ),
      )
      .where(eq(sales.customerId, contact.id));

    const payable = Number(totals?.payable ?? 0);
    const returned = Number(returnRow?.returned ?? 0);

    return {
      total: payable + openingBalance - returned,
      paid: Number(paidRow?.paid ?? 0),
      due: balance + openingBalance,
      totalInvoice: Number(totals?.count ?? 0),
      dueInvoice: Number(totals?.dueCount ?? 0),
    };
  }

  // Supplier side - purchases instead of sales.
  const [totals] = await db
    .select({
      payable: sql<number>`coalesce(sum(${purchaseOrders.payableAmount}), 0)`,
      count: sql<number>`count(*)`,
      dueCount: sql<number>`coalesce(sum(case when ${purchaseOrders.isPaid} <> 2 then 1 else 0 end), 0)`,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, contact.id));

  const [paidRow] = await db
    .select({
      paid: sql<number>`coalesce(sum(${payments.amount} - ${payments.returnAmount}), 0)`,
    })
    .from(payments)
    .innerJoin(
      purchaseOrders,
      and(
        eq(purchaseOrders.id, payments.payableId),
        eq(payments.payableType, MorphType.PurchaseOrder),
      ),
    )
    .where(eq(purchaseOrders.supplierId, contact.id));

  const [returnRow] = await db
    .select({
      returned: sql<number>`coalesce(sum(${productItemDetails.returnAmount}), 0)`,
    })
    .from(productItemDetails)
    .innerJoin(
      purchaseOrders,
      and(
        eq(purchaseOrders.id, productItemDetails.itemableId),
        eq(productItemDetails.itemableType, MorphType.PurchaseOrder),
      ),
    )
    .where(eq(purchaseOrders.supplierId, contact.id));

  const payable = Number(totals?.payable ?? 0);
  const returned = Number(returnRow?.returned ?? 0);

  return {
    total: payable + openingBalance - returned,
    paid: Number(paidRow?.paid ?? 0),
    due: balance + openingBalance,
    totalInvoice: Number(totals?.count ?? 0),
    dueInvoice: Number(totals?.dueCount ?? 0),
  };
}

/** `lastInvoice()` */
export async function contactLastInvoice(contactId: number) {
  const [row] = await db
    .select()
    .from(sales)
    .where(eq(sales.customerId, contactId))
    .orderBy(desc(sales.id))
    .limit(1);
  return row ?? null;
}

/**
 * `contact::contact.debit_transaction_list_table` - the contact's own ledger.
 *
 * The Blade walked the approved transactions of the contact's chart account in
 * insertion order, starting the running balance at `opening_balance` and adding
 * on Dr / subtracting on Cr regardless of the account type.
 */
export async function contactStatement(contact: ContactsRow) {
  const [account] = await db
    .select({ id: chartAccounts.id })
    .from(chartAccounts)
    .where(
      and(
        eq(chartAccounts.contactableType, MorphType.ContactModel),
        eq(chartAccounts.contactableId, contact.id),
      ),
    )
    .limit(1);

  const opening = toNumber(contact.openingBalance);
  if (!account) return { rows: [], opening, closing: opening };

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: vouchers.date,
      narration: vouchers.narration,
      referableId: vouchers.referableId,
      referableType: vouchers.referableType,
      invoiceNo: sales.invoiceNo,
    })
    .from(transactions)
    .innerJoin(
      vouchers,
      and(
        eq(vouchers.id, transactions.voucherableId),
        eq(transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .leftJoin(
      sales,
      and(eq(sales.id, vouchers.referableId), eq(vouchers.referableType, MorphType.Sale)),
    )
    .where(and(eq(transactions.accountId, account.id), eq(vouchers.isApprove, 1)))
    .orderBy(transactions.id);

  let balance = opening;
  const withBalance = rows.map((row) => {
    balance += row.type === 'Dr' ? Number(row.amount) : -Number(row.amount);
    return { ...row, amount: Number(row.amount), balance };
  });

  return { rows: withBalance, opening, closing: balance };
}

/** The customer's returned invoices - `$customer->sales->where('return_status', 1)`. */
export async function customerReturns(contactId: number) {
  return db
    .select()
    .from(sales)
    .where(and(eq(sales.customerId, contactId), eq(sales.returnStatus, 1)))
    .orderBy(desc(sales.id));
}

/** The supplier's returned purchase orders. */
export async function supplierReturns(contactId: number) {
  return db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.supplierId, contactId), eq(purchaseOrders.returnStatus, 1)))
    .orderBy(desc(purchaseOrders.id));
}

/**
 * `ContactRepository::customerSaleHistory($id)` / `supplierPurchaseHistory($id)`
 * - the line items of every sale or purchase order belonging to the contact,
 * behind the "Products" button on the contact detail screens. Combo lines have
 * no product SKU row, which is why the Blade printed the combo name instead.
 */
async function contactProductItems(
  contactId: number,
  itemableType: string,
  documentTable: typeof sales | typeof purchaseOrders,
  contactColumn: typeof sales.customerId | typeof purchaseOrders.supplierId,
) {
  return db
    .select({
      item: productItemDetails,
      sku: productSku.sku,
      productName: products.productName,
      comboName: comboProducts.name,
      invoiceNo: documentTable.invoiceNo,
      date: documentTable.date,
    })
    .from(productItemDetails)
    .innerJoin(
      documentTable,
      and(
        eq(documentTable.id, productItemDetails.itemableId),
        eq(productItemDetails.itemableType, itemableType),
      ),
    )
    .leftJoin(productSku, eq(productSku.id, productItemDetails.productSkuId))
    .leftJoin(products, eq(products.id, productSku.productId))
    .leftJoin(
      comboProducts,
      and(
        eq(comboProducts.id, productItemDetails.productableId),
        eq(productItemDetails.productableType, MorphType.ComboProduct),
      ),
    )
    .where(eq(contactColumn, contactId))
    .orderBy(productItemDetails.id);
}

export function customerSaleProductItems(contactId: number) {
  return contactProductItems(contactId, MorphType.Sale, sales, sales.customerId);
}

export function supplierPurchaseProductItems(contactId: number) {
  return contactProductItems(
    contactId,
    MorphType.PurchaseOrder,
    purchaseOrders,
    purchaseOrders.supplierId,
  );
}
