// Print shell - replaces the standalone `<html>` documents the print_view
// blades rendered. No sidebar, no header: just the sheet, sized to A4, with a
// print button that disappears on paper.

import { requireUser } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The print routes sat behind `auth` in the PHP router.
  await requireUser();

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-[210mm] bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}
