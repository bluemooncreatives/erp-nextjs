// Guest background - port of GeneralSettingsController@update_bg (`setting::bg`).

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';
import { PageHeader, Card } from '@/components/erp/page';
import { GuestBackgroundForm } from '../../setting/forms';

export const metadata: Metadata = { title: 'Guest Background' };

export default async function GuestBackgroundPage() {
  await authorize('guest-background');
  const setting = await generalSetting();

  return (
    <>
      <PageHeader
        title="Settings"
        breadcrumb={[{ label: 'Settings' }, { label: 'Guest Background' }]}
      />
      <Card title="Background Images">
        <GuestBackgroundForm
          loginBgUrl={assetUrl(setting.loginBg) ?? '/images/grid-image/image-01.png'}
          errorBgUrl={assetUrl(setting.errorPageBg) ?? '/images/grid-image/image-02.png'}
        />
      </Card>
    </>
  );
}
