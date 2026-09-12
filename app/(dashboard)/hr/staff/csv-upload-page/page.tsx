// Staff import - port of staffs.csv_upload.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { CsvUploadForm } from '../../../import/upload-form';
import { uploadStaffCsv } from '../../../import/actions';

export const metadata: Metadata = { title: 'Staff CSV Upload' };

export default async function Page() {
  await authorize('staffs.csv_upload');

  return (
    <>
      <PageHeader
        title="Staff CSV Upload"
        breadcrumb={[{ label: 'Staff' }, { label: 'Upload via CSV' }]}
      />
      <CsvUploadForm
        action={uploadStaffCsv}
        sampleHref="/uploads/staff.xlsx"
        backHref={ROUTES['staffs.index']}
        columns={["name", "email", "username", "password", "phone", "date_of_joining", "bank_name", "bank_branch_name", "bank_account_name", "bank_account_no", "current_address", "permanent_address", "basic_salary", "opening_balance", "employment_type", "leave_applicable_date"]}
      />
    </>
  );
}
