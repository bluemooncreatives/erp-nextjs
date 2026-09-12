'use client';

// Port of resources/views/auth/register.blade.php, wired to RegisterController's
// rules: name, a unique email, and a confirmed password of at least 8
// characters. The template's social sign-up buttons are dropped - the Laravel
// app had no social providers.

import { useActionState, useState } from 'react';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import { EyeCloseIcon, EyeIcon } from '@/icons';
import { AuthCard } from './AuthCard';
import { register, type AuthFormState } from '@/app/(auth)/actions';

const INITIAL: AuthFormState = {};

export default function SignUpForm({ companyName }: { companyName: string }) {
  const [state, formAction, pending] = useActionState(register, INITIAL);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthCard title="Sign Up" description={`Create your ${companyName} account.`}>
      <form action={formAction} className="space-y-5">
        {state.error ? (
          <p className="rounded-lg border border-error-500 bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/15 dark:text-error-400">
            {state.error}
          </p>
        ) : null}

        <div>
          <Label>
            Name<span className="text-error-500">*</span>
          </Label>
          <Input name="name" placeholder="Your name" defaultValue="" />
          {state.fieldErrors?.name ? (
            <p className="mt-1.5 text-xs text-error-500">{state.fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <Label>
            Email<span className="text-error-500">*</span>
          </Label>
          <Input name="email" type="email" placeholder="you@example.com" />
          {state.fieldErrors?.email ? (
            <p className="mt-1.5 text-xs text-error-500">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <Label>
            Password<span className="text-error-500">*</span>
          </Label>
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
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
          {pending ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
    </AuthCard>
  );
}
