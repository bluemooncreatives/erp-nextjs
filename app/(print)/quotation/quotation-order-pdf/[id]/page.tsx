// Quotation PDF - the `*_pdf` route. dompdf produced a file here; this renders the
// same sheet and opens the print dialog, where "Save as PDF" gives the document.

import { AutoPrint } from '@/components/erp/print-button';
import PrintView, { metadata as printMetadata } from '../../quotation-order-print-view/[id]/page';

export const metadata = printMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <>
      <AutoPrint />
      <PrintView {...props} />
    </>
  );
}
