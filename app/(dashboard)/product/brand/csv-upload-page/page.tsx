// Brand import - port of brand.csv_upload.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { CsvUploadForm } from '../../../import/upload-form';
import { uploadBrandCsv } from '../../../import/actions';

export const metadata: Metadata = { title: 'Brand CSV Upload' };

export default async function Page() {
  await authorize('brand.csv_upload');

  return (
    <>
      <PageHeader
        title="Brand CSV Upload"
        breadcrumb={[{ label: 'Brand' }, { label: 'Upload via CSV' }]}
      />
      <CsvUploadForm
        action={uploadBrandCsv}
        sampleHref="/uploads/brands.xlsx"
        backHref={ROUTES['brand.index']}
        columns={["name", "description"]}
      />
    </>
  );
}
