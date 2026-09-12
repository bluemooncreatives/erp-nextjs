// Login activity - port of UserActivityLogController@login_index
// (`useractivitylog::login_index`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { logActivityListsDuty } from '@/lib/activity-log';
import { toDateTimeString } from '@/lib/php-date';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ReportSummary } from '@/components/erp/report-summary';
import { LogIn, Radio, Users } from 'lucide-react';

export const metadata: Metadata = { title: 'User Login History' };

export default async function UserLoginLogPage() {
  await authorize('activity_log.login');
  const activities = await logActivityListsDuty();

  // A session with no logout time is one nobody has signed out of - either
  // still open, or ended by the browser closing rather than by signing out.
  const openCount = activities.filter((activity) => !activity.logoutTime).length;
  const userCount = new Set(activities.map((activity) => activity.userName).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        title="User Login History"
        breadcrumb={[{ label: 'Settings'}, { label:'User Login History' }]}
      />

      <ReportSummary
        figures={[
          { label: 'Sessions', value: activities.length, detail: 'Sign-ins recorded', icon: LogIn },
          { label: 'Users', value: userCount, detail: 'Who have signed in', icon: Users },
          { label: 'Never signed out', value: openCount, detail: 'No logout recorded', icon: Radio },
        ]}
      />

      <Card title="Login history" bodyClassName="">
        <DataTable
          columns={[
            { label: 'ID' },
            { label: 'User' },
            { label: 'Login At' },
            { label: 'Logout At' },
            { label: 'IP' },
            { label: 'Agent' },
            { label: 'Description' },
          ]}
          isEmpty={activities.length === 0}
          empty="No logins recorded."
        >
          {activities.map((activity, index) => (
            <Tr key={activity.id}>
              <Td>{index + 1}</Td>
              <Td className="font-medium text-foreground">
                {activity.userName ?? '-'}
              </Td>
              <Td>{toDateTimeString(activity.loginTime) ?? '-'}</Td>
              <Td>{toDateTimeString(activity.logoutTime) ?? '-'}</Td>
              <Td>{activity.ip}</Td>
              <Td className="max-w-xs truncate">{activity.agent}</Td>
              <Td>{activity.subject}</Td>
            </Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
