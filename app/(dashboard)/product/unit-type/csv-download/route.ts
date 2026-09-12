// `unit_type.csv_download` - the reference table as a CSV download.

import { authorize } from '@/lib/auth/permissions';
import { referenceCsvRows } from '@/lib/import/imports';
import { toCsv } from '@/lib/import/spreadsheet';
import { unitTypes } from '@/lib/db/schema';

export async function GET() {
  await authorize('unit_type.csv_download');

  const body = toCsv(await referenceCsvRows(unitTypes));

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="units_tbl.csv"',
    },
  });
}
