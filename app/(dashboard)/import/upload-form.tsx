'use client';

// The "upload via CSV" screens - one file field, a sample-file link and the
// Toastr result as an inline banner (product::brand.upload_via_csv.create and
// its siblings).

import { useActionState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import type { ImportFormState } from './actions';

const INITIAL: ImportFormState = {};

export function CsvUploadForm({
  action,
  sampleHref,
  backHref,
  columns,
}: {
  action: (prev: ImportFormState, formData: FormData) => Promise<ImportFormState>;
  sampleHref?: string;
  backHref: string;
  columns: string[];
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <Card
      title="Upload via CSV"
      desc="The first row of the sheet names the columns; every later row is one record."
      actions={
        sampleHref ? (
          <a
            href={sampleHref}
            download
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            Sample File Download
          </a>
        ) : null
      }
    >
      <form action={formAction} className="space-y-5">
        <FormAlert message={state.error} />
        <FormAlert message={state.success} variant="success" />

        <FormInput
          label="File"
          name="file"
          type="file"
          accept=".xlsx, .xls, .csv"
          required
          hint="CSV or XLSX, up to 2 MB. Binary .xls files must be saved as .xlsx first."
        />

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Expected columns
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {columns.join(', ')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SubmitButton>Upload</SubmitButton>
          <Link
            href={backHref}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </Card>
  );
}
