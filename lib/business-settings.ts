// ---------------------------------------------------------------------------
// Business settings - the replacement for `app('business_settings')`.
//
// The `business_settings` table is a flat list of feature toggles keyed by
// `type`, grouped by `category_type`. Two groups matter:
//
//   (no category)  email_verification, mail_notification, system_notification
//   'voucher'      whether each document type auto-posts an approved voucher
//                  (sale_voucher_approval, purchase_voucher_approval, ...)
// ---------------------------------------------------------------------------

import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { businessSettings } from '@/lib/db/schema';

export const allBusinessSettings = cache(async () => {
  return db.select().from(businessSettings);
});

/** `app('business_settings')->where('type', $t)->where('status', 1)->first()` */
export async function isEnabled(type: string): Promise<boolean> {
  const rows = await allBusinessSettings();
  return rows.some((r) => r.type === type && r.status === 1);
}

export const NotificationChannel = {
  Email: 'email_verification',
  Mail: 'mail_notification',
  Sms: 'sms_verification',
  System: 'system_notification',
} as const;

export const isEmailEnabled = () => isEnabled(NotificationChannel.Email);
export const isSmsEnabled = () => isEnabled(NotificationChannel.Sms);
export const isSystemNotificationEnabled = () => isEnabled(NotificationChannel.System);

/**
 * Voucher approval toggles. When enabled, the matching document posts its
 * voucher already approved instead of queueing it for review - the behaviour
 * the repositories read out of `business_settings` before saving.
 */
export const VoucherApproval = {
  BeginningStock: 'beginning_stock_voucher_approval',
  Sale: 'sale_voucher_approval',
  SaleReturn: 'sale_return_voucher_approval',
  Pos: 'pos_voucher_approval',
  Purchase: 'purchase_voucher_approval',
  PurchaseReturn: 'purchase_return_voucher_approval',
  Commission: 'commision_voucher_approval',
  Packing: 'packing_voucher_approval',
  RetailerAddBalance: 'retailer_add_balance_voucher_approval',
  RetailerSubtractBalance: 'retailer_substraction_balance_voucher_approval',
  AddBalance: 'add_balance_voucher_approval',
  Loan: 'loan_voucher_approval',
  Payroll: 'payroll_voucher_approval',
} as const;

export async function voucherAutoApproved(
  type: (typeof VoucherApproval)[keyof typeof VoucherApproval],
): Promise<boolean> {
  return isEnabled(type);
}

export async function setBusinessSetting(type: string, status: 0 | 1) {
  await db
    .update(businessSettings)
    .set({ status, updatedAt: new Date() })
    .where(eq(businessSettings.type, type));
}
