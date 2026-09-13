import { requireUser } from '@/lib/auth/permissions';
import { pdfResponse } from '@/lib/pdf/build';
import { saleInvoice } from '@/lib/pdf/sale-document';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const { definition, filename } = await saleInvoice(Number(id));
  return pdfResponse(definition, filename);
}
