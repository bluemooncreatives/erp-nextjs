'use client';

// Submit button that reflects the pending state of the enclosing server action,
// matching the "submitting..." swap the Blade forms did with jQuery.

import { useFormStatus } from 'react-dom';
import React, { type ReactNode } from 'react';

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
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md';
}) {
  const { pending } = useFormStatus();

  const sizeClasses = size === 'sm' ? 'px-4 py-2.5 text-sm' : 'px-5 py-3 text-sm';
  const variantClasses = {
    primary:
      'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300',
    outline:
      'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
    danger: 'bg-error-500 text-white hover:bg-error-600 disabled:bg-error-300',
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${sizeClasses} ${variantClasses} ${
        pending ? 'cursor-not-allowed opacity-70' : ''
      } ${className}`}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
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

  const variantClasses = {
    primary: 'text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10',
    outline: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5',
    danger: 'text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10',
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-theme-xs font-medium transition disabled:opacity-50 ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
