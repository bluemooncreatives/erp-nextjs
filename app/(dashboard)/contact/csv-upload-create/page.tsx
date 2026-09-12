// Contact import - port of contact_csv_upload.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { CsvUploadForm } from '../../import/upload-form';
import { uploadContactCsv } from '../../import/actions';

export const metadata: Metadata = { title: 'Contact CSV Upload' };

export default async function Page() {
  await authorize('contact_csv_upload');

  return (
    <>
      <PageHeader
        title="Contact CSV Upload"
        breadcrumb={[{ label: 'Contact' }, { label: 'Upload via CSV' }]}
      />
      <CsvUploadForm
        action={uploadContactCsv}
        sampleHref="/uploads/contact_csv.xlsx"
        backHref={ROUTES['add_contact.index']}
        columns={["name", "contact_type", "business_name", "tax_number", "opening_balance", "pay_term", "pay_term_condition", "credit_limit", "email", "mobile", "address"]}
      />
    </>
  );
}
