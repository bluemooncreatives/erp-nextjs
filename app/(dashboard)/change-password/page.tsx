// Change password - port of HomeController@change_password
// (`backEnd.profiles.password`).

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/permissions';
import { PageHeader, Card } from '@/components/erp/page';
import { ChangePasswordForm } from '../profile-forms';

export const metadata: Metadata = { title: 'Change Password' };

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <>
      <PageHeader title="Change Password" breadcrumb={[{ label: 'Change Password' }]} />
      <Card title="Change Password">
        <ChangePasswordForm />
      </Card>
    </>
  );
}
