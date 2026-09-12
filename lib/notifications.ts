// ---------------------------------------------------------------------------
// Notifications - port of app/Traits/Notification.php and app/Notification.php.
//
// `sendNotification()` fanned out over three channels, each gated by its own
// `business_settings` toggle: e-mail, SMS and an in-app row in `notifications`.
// The in-app row is polymorphic (`notifiable_type` / `notifiable_id`) pointing
// at the document that triggered it.
// ---------------------------------------------------------------------------

import 'server-only';
import { and, desc, eq, isNull, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { notifications } from '@/lib/db/schema';
import {
  isEmailEnabled,
  isSmsEnabled,
  isSystemNotificationEnabled,
} from '@/lib/business-settings';
import { sendMail } from '@/lib/mail';
import { sendSms } from '@/lib/sms';

export type NotificationTarget = {
  /** The document the notification is about - sets `notifiable_*`. */
  notifiableType: string;
  notifiableId: number;
};

export type SendNotificationOptions = NotificationTarget & {
  /** Stored in `notifications.type`, and used as the mail subject. */
  subject: string;
  /** Stored in `notifications.data`, and used as the SMS body. */
  message: string;
  /** HTML body for the e-mail channel. Falls back to `message`. */
  content?: string;
  email?: string | null;
  number?: string | null;
  userId?: number | null;
  /** Role name when the notification targets a role rather than one user. */
  role?: string | null;
  url?: string | null;
};

/** `sendNotification($type, $email, $subject, $content, $number, $message, ...)` */
export async function sendNotification(options: SendNotificationOptions): Promise<true> {
  if (options.email && (await isEmailEnabled())) {
    await sendMail({
      to: options.email,
      subject: options.subject,
      html: options.content ?? options.message,
    });
  }

  if (options.number && (await isSmsEnabled())) {
    await sendSms(options.number, options.message);
  }

  if (await isSystemNotificationEnabled()) {
    await db.insert(notifications).values({
      userId: options.userId ?? null,
      role: options.role ?? null,
      type: options.subject.slice(0, 191),
      notifiableType: options.notifiableType,
      notifiableId: options.notifiableId,
      data: options.message,
      url: options.url ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return true;
}

/**
 * Unread count for the header bell. A notification reaches a user when it is
 * addressed to them directly, or broadcast to everyone (`user_id` null).
 */
export async function unreadNotificationCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        isNull(notifications.readAt),
        or(eq(notifications.userId, userId), isNull(notifications.userId)),
      ),
    );
  return Number(row?.count ?? 0);
}

/** `HomeController@notification_list` */
export async function notificationList(limit = 100) {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/** `HomeController@notificationUpdate` - mark one as seen. */
export async function markNotificationRead(id: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(eq(notifications.id, id));
}

/** `HomeController@post_notification_read_all` - mark the selected ones seen. */
export async function markNotificationsRead(ids: number[]) {
  if (!ids.length) return;
  await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(isNull(notifications.readAt), inArray(notifications.id, ids)));
}

/** `HomeController@notification_read_all` */
export async function markAllNotificationsRead() {
  await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(isNull(notifications.readAt));
}
