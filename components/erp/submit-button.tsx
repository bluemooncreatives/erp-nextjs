'use client';

// Submit button that reflects the pending state of the enclosing server action,
// matching the "submitting..." swap the Blade forms did with jQuery.

import { useFormStatus } from 'react-dom';
import React, { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function SubmitButton({
  children,
  pendingLabel = 'Saving...',
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
  /** The PHP forms' three button roles, mapped onto the design system's. */
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md';
}) {
  const { pending } = useFormStatus();

  const mapped = (
    { primary: 'default', outline: 'outline', danger: 'destructive' } as const
  )[variant];

  return (
    <Button
      type="submit"
      variant={mapped}
      size={size === 'sm' ? 'sm' : 'default'}
      disabled={pending || props.disabled}
      className={className}
      {...props}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Delete/approve style action button inside a small inline form. */
export function ActionButton({
  children,
  confirm,
  variant = 'danger',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  confirm?: string;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const { pending } = useFormStatus();

  // Row actions read as text, not as filled buttons, so the table stays legible
  // with several of them per row.
  const tone = {
    primary: 'text-primary hover:bg-primary/10 hover:text-primary',
    outline: 'text-muted-foreground',
    danger: 'text-destructive hover:bg-destructive/10 hover:text-destructive',
  }[variant];

  return (
    <Button
      type="submit"
      variant="ghost"
      size="xs"
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={`${tone} ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}
