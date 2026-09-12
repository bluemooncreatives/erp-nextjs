'use client';

// Ports of auth/passwords/email.blade.php, auth/passwords/reset.blade.php and
// auth/verify.blade.php.

import { useActionState, useState } from 'react';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import { AuthCard } from './AuthCard';
import {
  resendVerificationEmail,
  resetPassword,
  sendPasswordResetLink,
  type AuthFormState,
} from '@/app/(auth)/actions';

const INITIAL: AuthFormState = {};

function Notice({ state }: { state: AuthFormState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      className={`rounded-lg border px-4 py-3 text-sm ${
        state.error
          ? 'border-error-500 bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400'
          : 'border-success-500 bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400'
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(sendPasswordResetLink, INITIAL);
  const [sent, setSent] = useState(false);

  return (
    <AuthCard
      title="Reset Password"
      description="Enter the email on your account and we will send a reset link."
    >
      <form
        action={formAction}
        onSubmit={() => setSent(true)}
        className="space-y-5"
      >
        <Notice state={state} />
        {sent && !state.error ? (
          <p className="rounded-lg border border-success-500 bg-success-50 px-4 py-3 text-sm text-success-600 dark:bg-success-500/15 dark:text-success-400">
            If that address belongs to an account, a reset link is on its way.
          </p>
        ) : null}

        <div>
          <Label>
            Email<span className="text-error-500">*</span>
          </Label>
          <Input name="email" type="email" placeholder="you@example.com" />
          {state.fieldErrors?.email ? (
            <p className="mt-1.5 text-xs text-error-500">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Sending...' : 'Send Password Reset Link'}
        </button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm({
  token,
  email,
}: {
  token: string;
  email?: string;
}) {
  const [state, formAction, pending] = useActionState(resetPassword, INITIAL);

  return (
    <AuthCard title="Set a New Password" description="Choose a new password for your account.">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        <Notice state={state} />

        <div>
          <Label>
            Email<span className="text-error-500">*</span>
          </Label>
          <Input name="email" type="email" defaultValue={email ?? ''} />
        </div>

        <div>
          <Label>
            Password<span className="text-error-500">*</span>
          </Label>
          <Input name="password" type="password" placeholder="At least 8 characters" />
          {state.fieldErrors?.password ? (
            <p className="mt-1.5 text-xs text-error-500">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <div>
          <Label>
            Confirm Password<span className="text-error-500">*</span>
          </Label>
          <Input name="password_confirmation" type="password" placeholder="Repeat password" />
          {state.fieldErrors?.password_confirmation ? (
            <p className="mt-1.5 text-xs text-error-500">
              {state.fieldErrors.password_confirmation}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Reset Password'}
        </button>
      </form>
    </AuthCard>
  );
}

export function VerifyEmailNotice({ justSent }: { justSent: boolean }) {
  const [state, formAction, pending] = useActionState(resendVerificationEmail, INITIAL);

  return (
    <AuthCard
      title="Verify Your Email"
      description="A verification link has been sent to your email address."
    >
      <form action={formAction} className="space-y-5">
        <Notice state={state} />
        {justSent && !state.success ? (
          <p className="rounded-lg border border-success-500 bg-success-50 px-4 py-3 text-sm text-success-600 dark:bg-success-500/15 dark:text-success-400">
            A verification link has been sent to your email address.
          </p>
        ) : null}

        <p className="text-sm text-gray-500 dark:text-gray-400">
          If you did not receive the email, enter your address and request another.
        </p>

        <div>
          <Label>Email</Label>
          <Input name="email" type="email" placeholder="you@example.com" />
          {state.fieldErrors?.email ? (
            <p className="mt-1.5 text-xs text-error-500">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Sending...' : 'Resend Verification Email'}
        </button>
      </form>
    </AuthCard>
  );
}
