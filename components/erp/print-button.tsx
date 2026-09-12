'use client';

import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The `window.print()` button the print_view blades rendered above the sheet.

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <div className="mb-6 flex justify-end print:hidden">
      <Button type="button" onClick={() => window.print()}>
        <Printer />
        {label}
      </Button>
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
