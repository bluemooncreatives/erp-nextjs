'use client';

// TailAdmin's sign-in form, wired to the ported LoginController.
//
// The PHP form accepted an email OR a username (`LoginController::username()`),
// and offered "remember me"; both are preserved. The social buttons the
// template shipped are dropped - the Laravel app had no social providers.

import { useActionState } from 'react';
import Link from 'next/link';
import React, { useState } from 'react';
import Checkbox from '@/components/form/input/Checkbox';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import Button from '@/components/ui/button/Button';
import { EyeCloseIcon, EyeIcon } from '@/icons';
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
  const [isChecked, setIsChecked] = useState(false);
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Login to your account
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Welcome back to {companyName}.
            </p>
          </div>

          {demoAccounts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {demoAccounts.map((account) => (
                  <form key={account.email} action={formAction}>
                    <input type="hidden" name="email" value={account.email} />
                    <input type="hidden" name="password" value="12345678" />
                    <button
                      type="submit"
                      disabled={pending}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-800 disabled:opacity-60 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                    >
                      {account.label}
                    </button>
                  </form>
                ))}
              </div>
              <div className="relative py-3 sm:py-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="p-2 text-gray-400 bg-white dark:bg-gray-900 sm:px-5 sm:py-2">
                    Or
                  </span>
                </div>
              </div>
            </>
          ) : null}

          <form action={formAction}>
            {next ? <input type="hidden" name="next" value={next} /> : null}

            <div className="space-y-6">
              {state.error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-error-300 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400"
                >
                  {state.error}
                </div>
              ) : null}

              <div>
                <Label>
                  Email or Username <span className="text-error-500">*</span>{' '}
                </Label>
                <Input
                  name="email"
                  placeholder="you@example.com"
                  type="text"
                  autoComplete="username"
                  error={Boolean(state.fieldErrors?.email)}
                  hint={state.fieldErrors?.email}
                />
              </div>

              <div>
                <Label>
                  Password <span className="text-error-500">*</span>{' '}
                </Label>
                <div className="relative">
                  <Input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    error={Boolean(state.fieldErrors?.password)}
                    hint={state.fieldErrors?.password}
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox checked={isChecked} onChange={setIsChecked} />
                  <input
                    type="hidden"
                    name="remember"
                    value={isChecked ? '1' : ''}
                  />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Keep me logged in
                  </span>
                </div>
                <Link
                  href="/password/reset"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Forgot password?
                </Link>
              </div>

              <div>
                <Button className="w-full" size="sm" disabled={pending}>
                  {pending ? 'Logging in...' : 'Sign in'}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
