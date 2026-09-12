'use server';

// Port of HomeController's notification endpoints.

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/permissions';
import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsRead,
} from '@/lib/notifications';

/** `HomeController@notification_read_all` */
export async function markAllRead(): Promise<void> {
  await requireUser();
  await markAllNotificationsRead();
  revalidatePath('/', 'layout');
}

/** `HomeController@notificationUpdate` */
export async function markRead(id: number): Promise<void> {
  await requireUser();
  await markNotificationRead(id);
  revalidatePath('/', 'layout');
}

/** `HomeController@post_notification_read_all` - the selected checkboxes. */
export async function markSelectedRead(formData: FormData): Promise<void> {
  await requireUser();
  const ids = formData
    .getAll('notifications')
    .map((v) => Number(v))
    .filter(Number.isFinite);
  await markNotificationsRead(ids);
  revalidatePath('/', 'layout');
}
