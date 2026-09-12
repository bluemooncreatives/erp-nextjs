// `password.request` - ForgotPasswordController@showLinkRequestForm.

import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/PasswordForms';

export const metadata: Metadata = { title: 'Reset Password' };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
