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
      <span className="block h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-brand-500 dark:bg-gray-700" />
      <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      {label ? (
        <span className="text-sm text-gray-700 dark:text-gray-400">{label}</span>
      ) : null}
    </label>
  );
}
