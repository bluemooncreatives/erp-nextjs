// Port of resources/views/auth/register.blade.php (RegisterController).

import type { Metadata } from 'next';
import { generalSetting } from '@/lib/settings';
import { config } from '@/lib/config';
import SignUpForm from '@/components/auth/SignUpForm';

export const metadata: Metadata = { title: 'Register' };

export default async function RegisterPage() {
  const setting = await generalSetting();

  return (
    <SignUpForm
      companyName={setting.companyName || setting.siteTitle || config.app.name}
    />
  );
}
