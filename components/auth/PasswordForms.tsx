'use client';

// Ports of auth/passwords/email.blade.php, auth/passwords/reset.blade.php and
// auth/verify.blade.php.

import React, { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  return state.error ? (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  ) : (
    <Success>{state.success}</Success>
  );
}

/** The design system's Alert has no success variant; this is the same shape. */
function Success({ children }: { children: React.ReactNode }) {
  return (
    <Alert className="border-success/30 text-success">
      <CheckCircle2 />
      <AlertDescription className="text-success/90">{children}</AlertDescription>
    </Alert>
  );
}

function Field({
  id,
  name,
  label,
  error,
  required = true,
  type = 'text',
  ...props
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  type?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Input id={id} name={name} type={type} aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(sendPasswordResetLink, INITIAL);
  const [sent, setSent] = useState(false);

  return (
    <AuthCard
      title="Reset Password"
      description="Enter the email on your account and we will send a reset link."
      backHref="/login"
    >
      <form action={formAction} onSubmit={() => setSent(true)} className="space-y-5">
        <Notice state={state} />
        {sent && !state.error ? (
          <Success>
            If that address belongs to an account, a reset link is on its way.
          </Success>
        ) : null}

        <Field
          id="forgot-email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          error={state.fieldErrors?.email}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Sending...' : 'Send Password Reset Link'}
        </Button>
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
    <AuthCard
      title="Set a New Password"
      description="Choose a new password for your account."
      backHref="/login"
    >
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        <Notice state={state} />

        <Field
          id="reset-email"
          name="email"
          type="email"
          label="Email"
          defaultValue={email ?? ''}
          autoComplete="email"
        />

        <Field
          id="reset-password"
          name="password"
          type="password"
          label="Password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
        />

        <Field
          id="reset-password-confirmation"
          name="password_confirmation"
          type="password"
          label="Confirm Password"
          placeholder="Repeat password"
          autoComplete="new-password"
          error={state.fieldErrors?.password_confirmation}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Saving...' : 'Reset Password'}
        </Button>
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
      backHref="/login"
    >
      <form action={formAction} className="space-y-5">
        <Notice state={state} />
        {justSent && !state.success ? (
          <Success>A verification link has been sent to your email address.</Success>
        ) : null}

        <p className="text-muted-foreground text-sm">
          If you did not receive the email, enter your address and request another.
        </p>

        <Field
          id="verify-email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          required={false}
          autoComplete="email"
          error={state.fieldErrors?.email}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Sending...' : 'Resend Verification Email'}
        </Button>
      </form>
    </AuthCard>
  );
}
