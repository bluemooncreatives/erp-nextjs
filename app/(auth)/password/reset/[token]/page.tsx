// `password.reset` - ResetPasswordController@showResetForm. The Blade filled
// the email in from the query string of the mailed link.

import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/PasswordForms';

export const metadata: Metadata = { title: 'Reset Password' };

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { token } = await params;
  const { email } = await searchParams;

  return <ResetPasswordForm token={token} email={email} />;
}
