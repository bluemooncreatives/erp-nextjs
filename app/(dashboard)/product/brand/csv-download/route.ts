// `brand.csv_download` - the reference table as a CSV download.

import { authorize } from '@/lib/auth/permissions';
import { referenceCsvRows } from '@/lib/import/imports';
import { toCsv } from '@/lib/import/spreadsheet';
import { brands } from '@/lib/db/schema';

export async function GET() {
  await authorize('brand.csv_download');

  const body = toCsv(await referenceCsvRows(brands));

  return new Response(body, {
    headers: {
      'Content-Type':'text/csv',
      'Content-Disposition':'attachment; filename="brands_tbl.csv"',
    },
  });
}
