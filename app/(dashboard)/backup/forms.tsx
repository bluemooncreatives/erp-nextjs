'use client';

// `backup::backup.index`'s two forms - the SQL upload and the "Generate New
// Backup" button, which was a plain link in the Blade.

import { useActionState } from 'react';
import { FormAlert, FormActions } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { generateBackup, importBackup, type BackupFormState } from './actions';

const EMPTY: BackupFormState = {};

export function ImportBackupForm() {
  const [state, action] = useActionState(importBackup, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />

      <input
        type="file"
        name="db_file"
        accept=".sql"
        required
        className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
      />

      <FormActions>
        <SubmitButton pendingLabel="Importing...">Update</SubmitButton>
      </FormActions>
    </form>
  );
}

export function GenerateBackupForm() {
  const [state, action] = useActionState(generateBackup, EMPTY);

  return (
    <form action={action} className="space-y-3">
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />
      <SubmitButton size="sm" pendingLabel="Backing up...">
        Generate New Backup
      </SubmitButton>
    </form>
  );
}
