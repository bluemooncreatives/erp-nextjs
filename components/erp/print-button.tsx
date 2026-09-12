'use client';

// The `window.print()` button the print_view blades rendered above the sheet.

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <div className="mb-6 flex justify-end print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        {label}
      </button>
    </div>
  );
}
