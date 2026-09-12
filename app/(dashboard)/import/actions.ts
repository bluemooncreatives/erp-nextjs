'use server';

// The `csv_upload_store` controller actions. Each validates the upload, runs
// the matching importer and reports the Toastr message the PHP flashed - a
// duplicate key was reported separately there (`$e->getCode() == 23000`).

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { getSession } from '@/lib/auth/session';
import { fileFrom } from '@/lib/uploads';
import { ROUTES } from '@/lib/routes';
import { UnsupportedSpreadsheetError } from '@/lib/import/spreadsheet';
import {
  importBankAccounts,
  importBrands,
  importContacts,
  importModels,
  importProducts,
  importStaff,
  importUnitTypes,
} from '@/lib/import/imports';

export type ImportFormState = { error?: string; success?: string };

const MAX_BYTES = 2048 * 1024; // `max:2048` kilobytes
const ALLOWED = ['.csv', '.xls', '.xlsx'];

function validate(file: File | null): string | null {
  if (!file || file.size === 0) return 'The file field is required.';
  if (file.size > MAX_BYTES) return 'The file may not be greater than 2048 kilobytes.';
  if (!ALLOWED.some((extension) => file.name.toLowerCase().endsWith(extension))) {
    return 'The file must be a file of type: csv, xls, xlsx.';
  }
  return null;
}

/** Duplicate keys surfaced their own message in every csv_upload_store. */
function failureMessage(error: unknown): string {
  if (error instanceof UnsupportedSpreadsheetError) return error.message;
  const text = String(error);
  if (text.includes('ER_DUP_ENTRY') || text.includes('Duplicate entry')) {
    return 'Duplicate entry is exist in your file !!!';
  }
  return 'Something went wrong. Upload again !!!';
}

async function run(
  permission: string,
  formData: FormData,
  redirectPath: string,
  importer: (file: File | null, userId: number) => Promise<{ imported: number }>,
): Promise<ImportFormState> {
  const file = fileFrom(formData, 'file');
  const invalid = validate(file);
  if (invalid) return { error: invalid };

  const user = await authorize(permission);

  try {
    const { imported } = await importer(file, user.id);
    await successLog(`Imported ${imported} rows`, user.id);
    revalidatePath(redirectPath);
    return { success: `Successfully Uploaded !!! (${imported} rows)` };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: failureMessage(error) };
  }
}

export async function uploadBrandCsv(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  return run('brand.csv_upload_store', formData, ROUTES['brand.index'], importBrands);
}

export async function uploadModelCsv(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  return run('model.csv_upload_store', formData, ROUTES['model.index'], importModels);
}

export async function uploadUnitTypeCsv(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  return run(
    'unit_type.csv_upload_store',
    formData,
    ROUTES['unit_type.index'],
    importUnitTypes,
  );
}

export async function uploadContactCsv(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  return run(
    'contact_csv_upload_store',
    formData,
    ROUTES['add_contact.index'],
    importContacts,
  );
}

export async function uploadBankAccountCsv(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  return run(
    'bank.account.csv_upload_store',
    formData,
    ROUTES['bank_accounts.index'],
    importBankAccounts,
  );
}

export async function uploadStaffCsv(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  return run('staffs.csv_upload_store', formData, ROUTES['staffs.index'], importStaff);
}

export async function uploadProductCsv(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const session = await getSession();
  const showroomId = session?.showroomId ?? 1;

  return run(
    'add_product.csv_upload_store',
    formData,
    ROUTES['add_product.create'],
    (file, userId) => importProducts(file, showroomId, userId),
  );
}
