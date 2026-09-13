'use client';

// The Blade `switch_toggle` control: a checkbox that posted its new status the
// moment it changed. Here it submits the enclosing form, which runs the server
// action, so the behaviour and the markup stay equivalent.

import { useRef } from 'react';

export function ToggleSwitch({
  name = 'status',
  checked,
  disabled = false,
  label,
}: {
  name?: string;
  checked: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label
      className={`relative inline-flex items-center gap-3 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      {/* The action reads `status` as the value it should store. */}
      <input type="hidden" name={name} value={checked ? 0 : 1} />
      <input
        ref={inputRef}
        type="checkbox"
        className="peer sr-only"
        defaultChecked={checked}
        disabled={disabled}
        onChange={(event) => {
          if (disabled) return;
          event.currentTarget.form?.requestSubmit();
        }}
      />
      <span className="bg-switch-background peer-checked:bg-primary peer-focus-visible:ring-ring/50 block h-5 w-9 rounded-full border border-transparent transition-colors peer-focus-visible:ring-[3px]" />
      <span className="bg-background pointer-events-none absolute top-0.5 start-0.5 size-4 rounded-full shadow-sm ring-1 ring-black/5 transition-transform peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4" />
      {label ? <span className="text-sm">{label}</span> : null}
    </label>
  );
}
