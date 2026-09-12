import 'server-only';

import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { chartAccounts, sales } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { singlePrice } from '@/lib/settings';

/** VoucherRecieveController::get_invoice_lists and its invoices Blade partial. */
export async function receiptInvoiceOptions(accountId: number) {
  const [account] = await db.select().from(chartAccounts).where(eq(chartAccounts.id, accountId)).limit(1);
  if (!account?.contactableId) return [];
  const owner = account.contactableType === MorphType.ContactModel
    ? eq(sales.customerId, account.contactableId)
    : account.contactableType === MorphType.User
      ? eq(sales.agentUserId, account.contactableId)
      : null;
  if (!owner) return [];

  const rows = await db.select({
    id: sales.id,
    invoiceNo: sales.invoiceNo,
    due: sql<number>`${sales.payableAmount} - coalesce((select sum(p.amount) from payments p where p.payable_id = ${sales.id} and p.payable_type = ${MorphType.Sale}), 0)`,
  }).from(sales).where(and(owner, ne(sales.status, 1))).orderBy(desc(sales.id));
  return Promise.all(rows.map(async (row) => ({
    value: row.id,
    label: `${row.invoiceNo ?? row.id} - (${await singlePrice(row.due)})`,
  })));
}
