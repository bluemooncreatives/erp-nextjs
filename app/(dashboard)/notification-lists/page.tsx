// Notification list - port of HomeController@notification_list
// (`backEnd.notifications.index`).

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/permissions';
import { notificationList } from '@/lib/notifications';
import { toDateTimeString } from '@/lib/php-date';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { FormCheckbox, FormActions } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { Badge } from '@/components/erp/badge';
import { ReportSummary } from '@/components/erp/report-summary';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { markSelectedRead, markAllRead } from '../notification-actions';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationListPage() {
  await requireUser();
  const notifications = await notificationList();

  const unseenCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumb={[{ label: 'Notifications' }]}
        actions={
          <form action={markAllRead}>
            <SubmitButton size="sm" variant="outline">
              Mark all as seen
            </SubmitButton>
          </form>
        }
      />

      <ReportSummary
        figures={[
          { label: 'Notifications', value: notifications.length, detail: 'In your inbox', icon: Bell },
          { label: 'Unseen', value: unseenCount, detail: 'Waiting on you', icon: BellRing },
          {
            label: 'Seen',
            value: notifications.length - unseenCount,
            detail: 'Already read',
            icon: CheckCheck,
          },
        ]}
      />

      <Card title="All notifications" bodyClassName="">
        <form action={markSelectedRead}>
          <DataTable
            columns={[
              { label: '' },
              { label: 'Subject' },
              { label: 'Message' },
              { label: 'Status' },
              { label: 'Date' },
            ]}
            isEmpty={notifications.length === 0}
            empty="No notifications."
          >
            {notifications.map((notification) => (
              <Tr key={notification.id}>
                <Td>
                  {notification.readAt ? null : (
                    <FormCheckbox
                      id={`notification-${notification.id}`}
                      name="notifications"
                      value={notification.id}
                      label=""
                    />
                  )}
                </Td>
                <Td className="font-medium text-foreground">
                  {notification.url ? (
                    <Link
                      href={notification.url}
                      className="text-primary hover:text-primary"
                    >
                      {notification.type}
                    </Link>
                  ) : (
                    notification.type
                  )}
                </Td>
                <Td>{notification.data}</Td>
                <Td>
                  <Badge color={notification.readAt ? 'light' : 'info'} size="sm">
                    {notification.readAt ? 'Seen':'Unseen'}
                  </Badge>
                </Td>
                <Td>{toDateTimeString(notification.createdAt) ?? '-'}</Td>
              </Tr>
            ))}
          </DataTable>

          {notifications.some((n) => !n.readAt) ? (
            <div className="px-6 pb-6">
              <FormActions>
                <SubmitButton size="sm">Mark selected as seen</SubmitButton>
              </FormActions>
            </div>
          ) : null}
        </form>
      </Card>
    </>
  );
}
