'use client';

// The notification bell, reading the ERP `notifications` table.
// "Mark all as read" maps to HomeController@notification_read_all.

import Link from 'next/link';
import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { markAllRead } from '@/app/(dashboard)/notification-actions';
import { ROUTES } from '@/lib/routes';

export type HeaderNotification = {
  id: number;
  type: string | null;
  data: string | null;
  url: string | null;
  createdAt: Date | null;
  readAt: Date | null;
};

export default function NotificationDropdown({
  items,
  unreadCount,
}: {
  items: HeaderNotification[];
  unreadCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
        >
          <Bell />
          {unreadCount > 0 ? (
            <span className="bg-warning absolute top-1.5 right-1.5 flex size-2 rounded-full">
              <span className="bg-warning absolute inline-flex size-full animate-ping rounded-full opacity-75" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-90 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 ? (
            <span className="text-muted-foreground text-xs">{unreadCount} unread</span>
          ) : null}
        </div>

        <ul className="minimal-scrollbar max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <li className="text-muted-foreground py-10 text-center text-sm">
              No notifications yet.
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="border-b last:border-b-0">
                <Link
                  href={item.url ?? ROUTES['all_notifications']}
                  className="hover:bg-muted block px-4 py-3"
                >
                  <span className="block text-sm font-medium">
                    {item.type ?? 'Notification'}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-sm">
                    {item.data}
                  </span>
                  <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                    <span>{item.readAt ? 'Seen' : 'Unread'}</span>
                    <span className="bg-muted-foreground/50 size-1 rounded-full" />
                    <span>{formatWhen(item.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>

        <div className="flex gap-2 border-t p-3">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={ROUTES['all_notifications']}>View all</Link>
          </Button>
          {unreadCount > 0 ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllRead();
                  router.refresh();
                })
              }
            >
              Mark all read
            </Button>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatWhen(date: Date | null): string {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
