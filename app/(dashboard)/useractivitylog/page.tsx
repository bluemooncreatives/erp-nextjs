// User activity log - port of UserActivityLogController@index
// (`useractivitylog::index`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { logActivityLists } from '@/lib/activity-log';
import { toDateTimeString } from '@/lib/php-date';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { Badge } from '@/components/erp/badge';

export const metadata: Metadata = { title: 'User Activity Log' };

/** The Blade's badge classes, keyed by `log_activity.type`. */
const TYPE_LABELS: Record<
  number,
  { label: string; color: 'error' | 'success' | 'warning'|'info' }
> = {
  0: { label: 'Error', color:'error' },
  1: { label: 'Success', color:'success' },
  2: { label: 'Warning', color:'warning' },
  3: { label: 'Info', color:'info' },
};

export default async function UserActivityLogPage() {
  await authorize('activity_log');
  const activities = await logActivityLists();

  return (
    <>
      <PageHeader
        title="User Activity Log"
        breadcrumb={[{ label: 'Settings'}, { label:'User Activity Log' }]}
      />

      <Card title={`Activities (${activities.length})`} bodyClassName="">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'Subject' },
            { label: 'Type' },
            { label: 'URL' },
            { label: 'IP' },
            { label: 'Agent' },
            { label: 'Date' },
            { label: 'User' },
          ]}
          isEmpty={activities.length === 0}
          empty="No activity recorded."
        >
          {activities.map((activity, index) => {
            const type = TYPE_LABELS[activity.type ?? 3] ?? TYPE_LABELS[3];
            return (
              <Tr key={activity.id}>
                <Td>{index + 1}</Td>
                <Td className="font-medium text-foreground">
                  {activity.subject}
                </Td>
                <Td>
                  <Badge color={type.color} size="sm">
                    {type.label}
                  </Badge>
                </Td>
                <Td className="max-w-xs truncate">{activity.url}</Td>
                <Td>{activity.ip}</Td>
                <Td className="max-w-xs truncate">{activity.agent}</Td>
                <Td>{toDateTimeString(activity.updatedAt) ?? '-'}</Td>
                <Td>{activity.userName ?? '-'}</Td>
              </Tr>
            );
          })}
        </DataTable>
      </Card>
    </>
  );
}
