// `verification.notice` - VerificationController@show (auth/verify.blade.php).

import type { Metadata } from 'next';
import { VerifyEmailNotice } from '@/components/auth/PasswordForms';

export const metadata: Metadata = { title: 'Verify Email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sp = await searchParams;
  return <VerifyEmailNotice justSent={sp.sent === '1'} />;
}
