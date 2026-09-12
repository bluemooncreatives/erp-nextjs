// Bank Account import - port of bank.account.csv_upload.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { CsvUploadForm } from '../../../import/upload-form';
import { uploadBankAccountCsv } from '../../../import/actions';

export const metadata: Metadata = { title: 'Bank Account CSV Upload' };

export default async function Page() {
  await authorize('bank.account.csv_upload');

  return (
    <>
      <PageHeader
        title="Bank Account CSV Upload"
        breadcrumb={[{ label: 'Bank Account' }, { label: 'Upload via CSV' }]}
      />
      <CsvUploadForm
        action={uploadBankAccountCsv}
        sampleHref="/uploads/bank_accounts.xlsx"
        backHref={ROUTES['bank_accounts.index']}
        columns={["bank_name", "branch_name", "account_name", "account_no", "openning_balance", "description"]}
      />
    </>
  );
}
