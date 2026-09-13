// ---------------------------------------------------------------------------
// Form fields for server-action forms.
//
// The ERP forms post through `<form action={serverAction}>` with native inputs,
// so these stay uncontrolled and keep working without client JavaScript.
//
// Selects are the exception. A native `<select>` can be made to match `Input`
// when closed, but its open list is drawn by the operating system and no
// stylesheet reaches it - so every dropdown in the product left the design
// system the moment it was clicked. `FormSelect` now renders the Radix
// listbox (see `select-control.tsx`) with a hidden input carrying the value,
// which is what keeps the form post identical to the native control's.
//
// They render the structure the Blade forms did: a label, the control and the
// validation message the action returns.
// ---------------------------------------------------------------------------

import React, { type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/components/ui/utils';
import { Phrase } from '@/context/TranslationContext';
import { SelectControl, type SelectOption } from './select-control';

export type { SelectOption };

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
          <Phrase>{label}</Phrase>
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

export function FormSelect({
  label,
  error,
  hint,
  options = [],
  placeholder,
  wrapperClassName,
  className = '',
  children,
  name,
  id,
  value,
  defaultValue,
  onChange,
  disabled,
  required,
  'aria-label': ariaLabel,
}: {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
  className?: string;
  /** Extra rows below the options. Must be `SelectItem`s, not `<option>`s. */
  children?: ReactNode;
  name?: string;
  id?: string;
  value?: string | number;
  defaultValue?: string | number;
  /** Receives a native-shaped event, so `e.target.value` reads the same as before. */
  onChange?: (event: { target: { name: string; value: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
}) {
  const controlId = id ?? name;
  const describedBy = controlId && (error || hint) ? `${controlId}-${error ? 'error' : 'hint'}` : undefined;

  return (
    <Field
      label={label}
      htmlFor={controlId}
      required={required}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <SelectControl
        name={name}
        id={controlId}
        options={options}
        placeholder={placeholder}
        value={value === undefined ? undefined : String(value)}
        defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
        onChange={onChange}
        disabled={disabled}
        required={required}
        invalid={Boolean(error)}
        describedBy={describedBy}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </SelectControl>
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
