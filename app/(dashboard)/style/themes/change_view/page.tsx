// Change view - port of GeneralSettingsController@change_view
// (`setting::themes.change_view`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { generalSetting } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { ChangeViewForm } from '../../../setting/forms';

export const metadata: Metadata = { title: 'Change View' };

export default async function ChangeViewPage() {
  await authorize('themes.change_view');
  const setting = await generalSetting();

  return (
    <>
      <PageHeader
        title="Change View"
        breadcrumb={[{ label: 'Settings' }, { label: 'Change View' }]}
      />
      <Card title="Change View">
        <ChangeViewForm defaultView={setting.defaultView ?? 'normal'} />
      </Card>
    </>
  );
}
