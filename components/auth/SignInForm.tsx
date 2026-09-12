'use client';

// Sign-in, wired to the ported LoginController.
//
// The PHP form accepted an email OR a username (`LoginController::username()`),
// and offered "remember me"; both are preserved. The social buttons the
// original template shipped are dropped - the Laravel app had no social
// providers.

import { useActionState, useState } from 'react';
import Link from 'next/link';
import React from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AuthCard } from './AuthCard';
import { login, type AuthFormState } from '@/app/(auth)/actions';

const INITIAL: AuthFormState = {};

export default function SignInForm({
  next,
  companyName,
  demoAccounts = [],
}: {
  next?: string;
  companyName: string;
  demoAccounts?: Array<{ label: string; email: string }>;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <AuthCard
      title="Login to your account"
      description={`Welcome back to ${companyName}.`}
    >
      {demoAccounts.length > 0 ? (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {demoAccounts.map((account) => (
              <form key={account.email} action={formAction}>
                <input type="hidden" name="email" value={account.email} />
                <input type="hidden" name="password" value="12345678" />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={pending}
                >
                  {account.label}
                </Button>
              </form>
            ))}
          </div>

          <div className="relative">
            <Separator />
            <span className="bg-card text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
              Or
            </span>
          </div>
        </div>
      ) : null}

      <form action={formAction} className="space-y-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {state.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="login-email">
            Email or Username <span className="text-destructive">*</span>
          </Label>
          <Input
            id="login-email"
            name="email"
            type="text"
            placeholder="you@example.com"
            autoComplete="username"
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? 'login-email-error' : undefined}
          />
          {state.fieldErrors?.email ? (
            <p id="login-email-error" className="text-destructive text-xs">
              {state.fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">
            Password <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(state.fieldErrors?.password)}
              aria-describedby={
                state.fieldErrors?.password ? 'login-password-error' : undefined
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              {showPassword ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </button>
          </div>
          {state.fieldErrors?.password ? (
            <p id="login-password-error" className="text-destructive text-xs">
              {state.fieldErrors.password}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="login-remember" className="font-normal">
            {/* Radix renders a hidden native checkbox alongside its button when
                `name` is set, so this still posts `remember=1` without JS. */}
            <Checkbox id="login-remember" name="remember" value="1" />
            Keep me logged in
          </Label>
          <Link
            href="/password/reset"
            className="text-primary text-sm hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Logging in...' : 'Sign in'}
        </Button>
      </form>

      <p className="text-muted-foreground mt-5 text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary hover:underline">
          Sign Up
        </Link>
      </p>
    </AuthCard>
  );
}
