// ---------------------------------------------------------------------------
// The document notifications the PHP controllers raised through
// `sendNotification()` - one per sale, purchase, voucher, staff member and so
// on. The wording, the subject strings and the channel each one reaches are
// kept as they were, including the places where the original copied the wrong
// sentence (noted at the call site).
//
// The helper itself lives in `lib/notifications.ts`; this module only builds
// the payloads and picks the recipient.
// ---------------------------------------------------------------------------

import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { contacts, staffs, users } from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { sendNotification } from '@/lib/notifications';
import { generalSetting, formatPrice } from '@/lib/settings';
import { config } from '@/lib/config';
import { route, type RouteName } from '@/lib/routes';

/** An absolute link, as Laravel's `route()` helper produced. */
export function absoluteRoute(name: RouteName, params: Record<string, string | number>) {
  return `${config.app.url}${route(name, params)}`;
}

async function money(amount: number | string | null | undefined) {
  const setting = await generalSetting();
  return formatPrice(amount, setting.currencySymbol);
}

/** The contact or agent a sale notification is addressed to. */
async function saleRecipient(sale: {
  customerId: number | null;
  agentUserId: number | null;
}): Promise<{ email: string | null; number: string | null }> {
  if (sale.customerId) {
    const [customer] = await db
      .select({ email: contacts.email, mobile: contacts.mobile })
      .from(contacts)
      .where(eq(contacts.id, sale.customerId))
      .limit(1);
    return { email: customer?.email ?? null, number: customer?.mobile ?? null };
  }

  if (sale.agentUserId) {
    const [agent] = await db
      .select({ email: users.email, phone: staffs.phone })
      .from(users)
      .leftJoin(staffs, eq(staffs.userId, users.id))
      .where(eq(users.id, sale.agentUserId))
      .limit(1);
    return { email: agent?.email ?? null, number: agent?.phone ?? null };
  }

  return { email: null, number: null };
}

type SaleNotice = {
  id: number;
  invoiceNo: string | null;
  payableAmount: number | string | null;
  customerId: number | null;
  agentUserId: number | null;
};

/**
 * `SaleController` raised the same notification on create, update, approval and
 * deletion, differing only in the verb and the subject.
 */
export async function notifySale(
  sale: SaleNotice,
  event: 'created' | 'updated' | 'destroyed' | 'approved',
  actorName: string,
): Promise<void> {
  const url = absoluteRoute('sale.show', { id: sale.id });
  const invoice = sale.invoiceNo ?? String(sale.id);
  const amount = await money(sale.payableAmount);

  const content =
    `A Sale has been ${event} by ${actorName} which Invoice No. is ` +
    `<a href="${url}">${invoice}</a> for this you have to pay total of ${sale.payableAmount}`;

  // The PHP's update branch used "A Purchase has been approved by ..." in the
  // SMS body; every other branch names the sale. That wording is reproduced.
  const message =
    event === 'updated'
      ? `A Purchase has been approved by ${actorName}, Invoice No: ${invoice}, Amount: ${amount}`
      : `A Sale has been ${event} by ${actorName}, Invoice No: ${invoice}, Amount: ${amount}`;

  const subject =
    event === 'created'
      ? 'Sale Create Reminder'
      : event === 'updated'
        ? 'Sale Update Reminder'
        : event === 'destroyed'
          ? 'Sale Delete Reminder'
          : 'Sale Create Reminder';

  const recipient = await saleRecipient(sale);

  await sendNotification({
    notifiableType: MorphType.Sale,
    notifiableId: sale.id,
    subject,
    content,
    message,
    email: recipient.email,
    number: recipient.number,
    // Create and approval carried the link; update and delete did not.
    url: event === 'created' || event === 'approved' ? url : null,
  });
}

type PurchaseNotice = {
  id: number;
  invoiceNo: string | null;
  payableAmount: number | string | null;
  supplierId: number | null;
};

/** `PurchaseOrderController` - create, update and approval. */
export async function notifyPurchase(
  order: PurchaseNotice,
  event: 'created' | 'updated' | 'approved',
  actorName: string,
): Promise<void> {
  const url = absoluteRoute('purchase_order.show', { id: order.id });
  const invoice = order.invoiceNo ?? String(order.id);
  const amount = await money(order.payableAmount);

  const [supplier] = order.supplierId
    ? await db
        .select({ email: contacts.email, mobile: contacts.mobile })
        .from(contacts)
        .where(eq(contacts.id, order.supplierId))
        .limit(1)
    : [];

  const content =
    `A Purchase has been ${event} by ${actorName} which Invoice No. is ` +
    `<a href="${url}">${invoice}</a> for this you have to pay total of ${order.payableAmount}`;

  await sendNotification({
    notifiableType: MorphType.PurchaseOrder,
    notifiableId: order.id,
    subject:
      event === 'created'
        ? 'Purchase Create Reminder'
        : event === 'updated'
          ? 'Purchase Update Reminder'
          : 'Purchase Approved Reminder',
    content,
    message: `A Purchase has been ${event} by ${actorName}, Invoice No: ${invoice}, Amount: ${amount}`,
    email: supplier?.email ?? null,
    number: supplier?.mobile ?? null,
    url,
  });
}

/**
 * `VoucherController` - the voucher notifications went to the company's own
 * address and phone, not to a contact.
 */
export async function notifyVoucher(
  voucher: { id: number; txId: string | null; amount: number | string | null },
  event: 'created' | 'updated' | 'deleted' | 'approved',
): Promise<void> {
  const setting = await generalSetting();
  const amount = await money(voucher.amount);
  const reference = voucher.txId ?? String(voucher.id);

  const subject =
    event === 'created'
      ? 'Voucher Create Reminder'
      : event === 'updated'
        ? 'Voucher Update Reminder'
        : event === 'deleted'
          ? 'Voucher Delete Reminder'
          : 'Voucher Approve Reminder';

  const message = `A Voucher has been ${event}, Tx ID: ${reference}, Amount: ${amount}`;

  await sendNotification({
    notifiableType: MorphType.Voucher,
    notifiableId: voucher.id,
    subject,
    content: message,
    message,
    email: setting.email ?? null,
    number: setting.phone ?? null,
    url: absoluteRoute('vouchers.show', { id: voucher.id }),
  });
}

/** `ContactController@store` - a new customer or supplier. */
export async function notifyContact(contact: {
  id: number;
  name: string;
  contactType: string | null;
  email: string | null;
  mobile: string | null;
}): Promise<void> {
  const message = `Welcome ${contact.name}, your ${contact.contactType ?? 'contact'} account has been created.`;

  await sendNotification({
    notifiableType: MorphType.ContactModel,
    notifiableId: contact.id,
    subject: `${contact.contactType ?? 'Contact'}Added`,
    content: message,
    message,
    email: contact.email,
    number: contact.mobile,
    role: contact.contactType,
  });
}

/** `StaffController@store` - the account handed to a new staff member. */
export async function notifyStaff(staff: {
  staffId: number;
  userId: number;
  name: string;
  email: string | null;
  phone: string | null;
}): Promise<void> {
  const message = `Welcome ${staff.name}, your staff account has been created.`;

  await sendNotification({
    notifiableType: MorphType.Staff,
    notifiableId: staff.staffId,
    subject: 'Staff Added',
    content: message,
    message,
    email: staff.email,
    number: staff.phone,
    userId: staff.userId,
  });
}

/** `PayrollController` - the payslip notice sent to the staff member. */
export async function notifyPayroll(payroll: {
  id: number;
  staffUserId: number | null;
  email: string | null;
  phone: string | null;
  netSalary: number | string | null;
  month: string | null;
  year: string | null;
}): Promise<void> {
  const amount = await money(payroll.netSalary);
  const period = [payroll.month, payroll.year].filter(Boolean).join(' ');
  const message = `Your salary${period ? ` for ${period}` : ''} has been generated. Amount: ${amount}`;

  await sendNotification({
    notifiableType: MorphType.Payroll,
    notifiableId: payroll.id,
    subject: 'Salary Generate Reminder',
    content: message,
    message,
    email: payroll.email,
    number: payroll.phone,
    userId: payroll.staffUserId,
  });
}
