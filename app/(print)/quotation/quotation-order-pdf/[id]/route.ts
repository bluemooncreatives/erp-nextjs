import { requireUser } from '@/lib/auth/permissions';
import { pdfResponse } from '@/lib/pdf/build';
import { quotationInvoice } from '@/lib/pdf/quotation-document';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { definition, filename } = await quotationInvoice(Number(id));
  return pdfResponse(definition, filename);
}
