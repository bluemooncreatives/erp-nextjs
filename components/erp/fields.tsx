// ---------------------------------------------------------------------------
// Form fields for server-action forms.
//
// The ERP forms post through `<form action={serverAction}>` with native inputs,
// so these stay uncontrolled and keep working without client JavaScript - which
// rules out the design system's Radix Select and Checkbox, both of which are
// buttons that post nothing on their own. The controls here are native
// elements wearing the same tokens, so they match the rest of the product while
// still submitting on a plain form post.
//
// They render the structure the Blade forms did: a label, the control and the
// validation message the action returns.
// ---------------------------------------------------------------------------

import React, { type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/components/ui/utils';

/** The native `<select>`, matching `Input`'s box. */
const SELECT_CONTROL =
  'border-input bg-input-background dark:bg-input/30 flex h-9 w-full min-w-0 appearance-none rounded-md border px-3 py-1 text-base transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

export function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-center gap-1 text-sm leading-none font-medium select-none"
    >
      {children}
      {required ? <span className="text-destructive">*</span> : null}
    </label>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-destructive mt-1.5 text-xs">{message}</p>;
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className = '',
  children,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      {label ? (
        <FieldLabel htmlFor={htmlFor} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      {children}
      {hint && !error ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
      ) : null}
      <FieldError message={error} id={htmlFor ? `${htmlFor}-error` : undefined} />
    </div>
  );
}

export function FormInput({
  label,
  error,
  hint,
  wrapperClassName,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}) {
  const id = props.id ?? props.name;
  return (
    <Field
      label={label}
      htmlFor={id}
      required={props.required}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={id && (error || hint) ? `${id}-${error ? 'error' : 'hint'}` : undefined} className={className} {...props} />
    </Field>
  );
}

export function FormTextarea({
  label,
  error,
  hint,
  wrapperClassName,
  className = '',
  rows = 3,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}) {
  const id = props.id ?? props.name;
  return (
    <Field
      label={label}
      htmlFor={id}
      required={props.required}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <Textarea
        id={id}
        rows={rows}
        aria-invalid={Boolean(error)} aria-describedby={id && (error || hint) ? `${id}-${error ? 'error' : 'hint'}` : undefined}
        className={className}
        {...props}
      />
    </Field>
  );
}

export type SelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

export function FormSelect({
  label,
  error,
  hint,
  options = [],
  placeholder,
  wrapperClassName,
  className = '',
  children,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
  children?: ReactNode;
}) {
  const id = props.id ?? props.name;
  return (
    <Field
      label={label}
      htmlFor={id}
      required={props.required}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      {/* The chevron is drawn as a background image rather than an overlaid
          element, so the control stays a single native <select>. */}
      <select
        id={id}
        data-slot="native-select"
        aria-invalid={Boolean(error)} aria-describedby={id && (error || hint) ? `${id}-${error ? 'error' : 'hint'}` : undefined}
        className={cn(
          SELECT_CONTROL,
          "bg-[length:0.65rem] bg-[position:right_0.75rem_center] bg-no-repeat pr-9 bg-[image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E\")]",
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    </Field>
  );
}

export function FormCheckbox({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        id={id}
        type="checkbox"
        className={cn(
          'border-input text-primary accent-primary focus-visible:ring-ring/50 size-4 rounded-[4px] border outline-none focus-visible:ring-[3px]',
          className,
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function FormRadio({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = props.id ?? `${props.name}-${props.value}`;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        id={id}
        type="radio"
        className={cn(
          'border-input text-primary accent-primary focus-visible:ring-ring/50 size-4 border outline-none focus-visible:ring-[3px]',
          className,
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

/** Banner for an action-level message (the Toastr flash the PHP showed). */
export function FormAlert({
  variant = 'error',
  message,
}: {
  variant?: 'error' | 'success' | 'warning' | 'info';
  message?: string | null;
}) {
  if (!message) return null;

  const styles = {
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    info: 'border-info/30 bg-info/10 text-info',
  } as const;

  const Icon = {
    error: AlertCircle,
    success: CheckCircle2,
    warning: TriangleAlert,
    info: Info,
  }[variant];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm',
        styles[variant],
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/** Row of form buttons, right-aligned like the Blade forms' footer. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5 max-sm:[&>*]:flex-1">{children}</div>
  );
}
