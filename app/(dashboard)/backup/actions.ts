'use server';

// Backup actions - port of Modules/Backup BackupController.

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { createBackup, deleteBackup, importDump } from '@/lib/backup';
import { fileFrom } from '@/lib/uploads';
import { ROUTES } from '@/lib/routes';
import { actionFormData } from '@/lib/forms';

export type BackupFormState = { error?: string; success?: string };

/** `BackupController@create` */
export async function generateBackup(
  _prev: BackupFormState,
  _formData: FormData,
): Promise<BackupFormState> {
  const user = await authorize('backup.create');

  const result = await createBackup();
  if (!result.ok) {
    await errorLog(result.message, user.id);
    return { error: result.message };
  }

  await successLog(result.message, user.id);
  revalidatePath(ROUTES['backup.index']);
  return { success: result.message };
}

/** `BackupController@delete` */
export async function removeBackup(formData: FormData): Promise<void> {
  const folder = String(formData.get('dir') ?? '');
  const user = await authorize('backup.delete');

  const removed = await deleteBackup(folder);
  await (removed
    ? successLog('Database backup has been deleted', user.id)
    : errorLog(`Backup folder not found: ${folder}`, user.id));

  revalidatePath(ROUTES['backup.index']);
}

/** `BackupController@import` */
export async function importBackup(
  _prev: BackupFormState,
  formData: FormData,
): Promise<BackupFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('backup.import');

  const file = fileFrom(formData, 'db_file');
  if (!file) return { error: 'Invalid File, file should be sql' };

  const result = await importDump(file);
  if (!result.ok) {
    await errorLog(result.message, user.id);
    return { error: result.message };
  }

  await successLog(result.message, user.id);
  // Every screen already reads live: the dashboard layout is `force-dynamic`,
  // so nothing here was cached for a revalidation to bust. `revalidatePath('/',
  // 'layout')` was tried for that reason, but revalidating the *whole* layout
  // clobbers this action's own `useActionState` reply before it reaches the
  // response - the restore succeeds, but the person who just ran it never sees
  // that it did. Scoped to this page, like `generateBackup`, it does not.
  revalidatePath(ROUTES['backup.index']);
  return { success: result.message };
}
