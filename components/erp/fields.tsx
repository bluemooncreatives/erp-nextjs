// ---------------------------------------------------------------------------
// Form fields for server-action forms.
//
// TailAdmin's own Select/Checkbox are controlled client components; the ERP
// forms post through `<form action={serverAction}>` with native inputs, so
// these mirror the template's styling while staying uncontrolled.
//
// They render the same structure the Blade forms did: a label, the control and
// the validation message the action returns.
// ---------------------------------------------------------------------------

import React, { type ReactNode } from 'react';

const CONTROL =
  'h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

const CONTROL_ERROR =
  'h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 text-error-800 border-error-500 focus:ring-error-500/10 dark:text-error-400 dark:border-error-500 dark:bg-gray-900';

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
      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
    >
      {children}
      {required ? <span className="text-error-500"> *</span> : null}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-error-500">{message}</p>;
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
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
      <FieldError message={error} />
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
      <input
        id={id}
        className={`${error ? CONTROL_ERROR : CONTROL} ${className}`}
        {...props}
      />
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
      <textarea
        id={id}
        rows={rows}
        className={`w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 ${className}`}
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
      <select
        id={id}
        className={`${error ? CONTROL_ERROR : CONTROL} pr-11 ${className}`}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
          >
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </Field>
  );
}

export function FormCheckbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 text-sm text-gray-700 dark:text-gray-400"
    >
      <input
        id={id}
        type="checkbox"
        className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function FormRadio({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const id = props.id ?? `${props.name}-${props.value}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 text-sm text-gray-700 dark:text-gray-400"
    >
      <input
        id={id}
        type="radio"
        className="h-5 w-5 border-gray-300 text-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

/** Banner for an action-level error message (the Toastr error the PHP flashed). */
export function FormAlert({
  variant = 'error',
  message,
}: {
  variant?: 'error' | 'success' | 'warning' | 'info';
  message?: string | null;
}) {
  if (!message) return null;

  const styles = {
    error:
      'border-error-500 bg-error-50 text-error-600 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400',
    success:
      'border-success-500 bg-success-50 text-success-600 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-400',
    warning:
      'border-warning-500 bg-warning-50 text-warning-600 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-400',
    info: 'border-blue-light-500 bg-blue-light-50 text-blue-light-600 dark:border-blue-light-500/30 dark:bg-blue-light-500/15 dark:text-blue-light-400',
  } as const;

  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${styles[variant]}`}>
      {message}
    </div>
  );
}

/** Row of form buttons, right-aligned like the Blade forms' footer. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-2">{children}</div>
  );
}
