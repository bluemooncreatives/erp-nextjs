// Unit Type import - port of unit_type.csv_upload.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { CsvUploadForm } from '../../../import/upload-form';
import { uploadUnitTypeCsv } from '../../../import/actions';

export const metadata: Metadata = { title: 'Unit Type CSV Upload' };

export default async function Page() {
  await authorize('unit_type.csv_upload');

  return (
    <>
      <PageHeader
        title="Unit Type CSV Upload"
        breadcrumb={[{ label: 'Unit Type' }, { label: 'Upload via CSV' }]}
      />
      <CsvUploadForm
        action={uploadUnitTypeCsv}
        sampleHref="/uploads/unit_types.xlsx"
        backHref={ROUTES['unit_type.index']}
        columns={["name", "description"]}
      />
    </>
  );
}
