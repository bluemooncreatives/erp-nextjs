// Model import - port of model.csv_upload.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { CsvUploadForm } from '../../../import/upload-form';
import { uploadModelCsv } from '../../../import/actions';

export const metadata: Metadata = { title: 'Model CSV Upload' };

export default async function Page() {
  await authorize('model.csv_upload');

  return (
    <>
      <PageHeader
        title="Model CSV Upload"
        breadcrumb={[{ label: 'Model' }, { label: 'Upload via CSV' }]}
      />
      <CsvUploadForm
        action={uploadModelCsv}
        sampleHref="/uploads/model_types.xlsx"
        backHref={ROUTES['model.index']}
        columns={["name", "description"]}
      />
    </>
  );
}
