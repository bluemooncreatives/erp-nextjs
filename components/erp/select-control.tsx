'use client';

// ---------------------------------------------------------------------------
// The product's Select, wired so a plain server-action form still receives it.
//
// ERP forms post through `<form action={serverAction}>`, which is why every
// select here used to be a native `<select>`: Radix's Select is a button, and
// a button posts nothing. The cost was the part no stylesheet can reach - the
// open list is drawn by the operating system, so every dropdown in the product
// dropped out of the design system the moment it was clicked (system font,
// system blue highlight, system scrollbar).
//
// This keeps both: the Radix listbox for the UI, plus a hidden input carrying
// the current value under the same `name`, so `FormData` sees exactly what the
// native control used to submit.
//
// The one thing lost is submitting with JavaScript off - the hidden input is
// populated by React. Every screen using this already relies on client state
// for its totals, so nothing regresses in practice.
// ---------------------------------------------------------------------------

import { useId, useState, type ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/ui/utils';

export type SelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

/**
 * Radix forbids an empty `value` on an item - it reserves "" for "nothing
 * selected". ERP option lists use "" for the "All"/"None" row, so it is
 * swapped for a sentinel inside the listbox and swapped back on the way out;
 * the hidden input always carries what the native control would have posted.
 */
const EMPTY = '__erp_empty__';
const toItem = (value: string) => (value === '' ? EMPTY : value);
const fromItem = (value: string) => (value === EMPTY ? '' : value);

export interface SelectControlProps {
  /** Posted field name. Omit for a select that only drives client state. */
  name?: string;
  id?: string;
  options?: SelectOption[];
  /** The "nothing chosen" row, and the greyed text on the closed trigger. */
  placeholder?: string;
  /** Controlled value. Omit to let the control keep its own. */
  value?: string;
  defaultValue?: string;
  /** Called with a native-shaped event, so existing `e.target.value` handlers keep working. */
  onChange?: (event: { target: { name: string; value: string } }) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  size?: 'sm' | 'default';
  /** Extra rows below the options - a "Create new..." entry, for instance. */
  children?: ReactNode;
  'aria-label'?: string;
}

export function SelectControl({
  name,
  id,
  options = [],
  placeholder,
  value,
  defaultValue,
  onChange,
  onValueChange,
  disabled,
  required,
  invalid,
  describedBy,
  className,
  size = 'default',
  children,
  'aria-label': ariaLabel,
}: SelectControlProps) {
  const fallbackId = useId();
  const controlId = id ?? name ?? fallbackId;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? value : internal;

  const handleChange = (next: string) => {
    const plain = fromItem(next);
    if (!isControlled) setInternal(plain);
    onValueChange?.(plain);
    onChange?.({ target: { name: name ?? '', value: plain } });
  };

  // A placeholder row is only offered when the field is optional: on a
  // required field it would be a selectable way to submit nothing.
  const showEmptyRow = Boolean(placeholder) && !required;

  return (
    <>
      {name ? <input type="hidden" name={name} value={current} /> : null}

      <Select
        value={toItem(current)}
        onValueChange={handleChange}
        disabled={disabled}
        // Radix's own required/name plumbing is not used: the hidden input is
        // what actually posts, so leaving them off avoids a second, invisible
        // control fighting it inside the same form.
      >
        <SelectTrigger
          id={controlId}
          size={size}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          className={cn('w-full', className)}
        >
          <SelectValue placeholder={placeholder ?? 'Select'} />
        </SelectTrigger>

        <SelectContent>
          {showEmptyRow ? (
            <SelectItem value={EMPTY} className="text-muted-foreground">
              {placeholder}
            </SelectItem>
          ) : null}

          {options.map((option) => (
            <SelectItem
              key={String(option.value)}
              value={toItem(String(option.value))}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}

          {children}
        </SelectContent>
      </Select>
    </>
  );
}
