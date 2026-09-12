'use client';

import { useEffect } from 'react';

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

/**
 * The `*_pdf` routes handed the browser a finished PDF (dompdf). There is no
 * PDF engine here, so those routes render the same sheet and open the browser's
 * print dialog, where "Save as PDF" produces the same document.
 */
export function AutoPrint() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
