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
import { markSelectedRead, markAllRead } from '../notification-actions';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationListPage() {
  await requireUser();
  const notifications = await notificationList();

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

      <Card title={`Notifications (${notifications.length})`} bodyClassName="">
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
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {notification.url ? (
                    <Link
                      href={notification.url}
                      className="text-brand-500 hover:text-brand-600"
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
                    {notification.readAt ? 'Seen' : 'Unseen'}
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
