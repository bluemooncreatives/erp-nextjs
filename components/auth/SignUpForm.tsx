'use client';

// Port of resources/views/auth/register.blade.php, wired to RegisterController's
// rules: name, a unique email, and a confirmed password of at least 8
// characters. The original template's social sign-up buttons are dropped - the
// Laravel app had no social providers.

import { useActionState, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from './AuthCard';
import { register, type AuthFormState } from '@/app/(auth)/actions';
import { Phrase } from '@/context/TranslationContext';

const INITIAL: AuthFormState = {};

export default function SignUpForm({ companyName }: { companyName: string }) {
  const [state, formAction, pending] = useActionState(register, INITIAL);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthCard
      title="Sign Up"
      description={`Create your ${companyName} account.`}
      backHref="/login"
    >
      <form action={formAction} className="space-y-5">
        {state.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field
          id="register-name"
          name="name"
          label="Name"
          placeholder="Your name"
          error={state.fieldErrors?.name}
        />

        <Field
          id="register-email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          error={state.fieldErrors?.email}
        />

        <div className="space-y-2">
          <Label htmlFor="register-password">
            <Phrase>Password</Phrase> <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="register-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="pe-10"
              aria-invalid={Boolean(state.fieldErrors?.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
          {state.fieldErrors?.password ? (
            <p className="text-destructive text-xs">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <Field
          id="register-password-confirmation"
          name="password_confirmation"
          type="password"
          label="Confirm Password"
          placeholder="Repeat password"
          autoComplete="new-password"
          error={state.fieldErrors?.password_confirmation}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>
    </AuthCard>
  );
}

function Field({
  id,
  name,
  label,
  error,
  type = 'text',
  ...props
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  type?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Input id={id} name={name} type={type} aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
