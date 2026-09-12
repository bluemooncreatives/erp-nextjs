'use client';

// Submit button that reflects the pending state of the enclosing server action,
// matching the "submitting..." swap the Blade forms did with jQuery.

import { useFormStatus } from 'react-dom';
import React, { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

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
      {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" />{pendingLabel}</> : children}
    </Button>
  );
}

/** Delete/approve style action button inside a small inline form. */
export function ActionButton({
  children,
  confirm,
  variant = 'danger',
  className = '',
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  confirm?: string;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);

  // Row actions read as text, not as filled buttons, so the table stays legible
  // with several of them per row.
  const tone = {
    primary: 'text-primary hover:bg-primary/10 hover:text-primary',
    outline: 'text-muted-foreground',
    danger: 'text-destructive hover:bg-destructive/10 hover:text-destructive',
  }[variant];

  return (
    <>
    <Button
      ref={buttonRef}
      type="submit"
      variant="ghost"
      size="xs"
      disabled={pending || props.disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (confirm && !confirmed.current) {
          event.preventDefault();
          setOpen(true);
        }
        confirmed.current = false;
      }}
      className={`${tone} ${className}`}
      {...props}
    >
      {children}
    </Button>
    {confirm ? <ConfirmDialog open={open} onOpenChange={setOpen}
      title={typeof children === 'string' ? children : 'Confirm action'} description={confirm}
      confirmLabel={typeof children === 'string' ? children : 'Continue'}
      tone={variant === 'danger' ? 'danger' : 'default'} pending={pending}
      onConfirm={() => {
        setOpen(false);
        confirmed.current = true;
        const button = buttonRef.current;
        if (button?.form) button.form.requestSubmit(button);
        confirmed.current = false;
      }} /> : null}
    </>
  );
}
