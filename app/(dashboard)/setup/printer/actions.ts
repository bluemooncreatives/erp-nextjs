'use server';

// PrinterController@store / @update / @delete. `PrinterRequest` required every
// field, which is checked here before anything is written.

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import { createPrinter, deletePrinter, updatePrinter } from '@/lib/setup/printers';
import type { ReferenceFormState } from '@/components/erp/reference-crud';
import { actionFormData } from '@/lib/forms';

function read(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  return {
    id: formData.get('id') ? Number(formData.get('id')) : null,
    name: text('name'),
    connectionType: text('connection_type'),
    charPerLine: text('char_per_line'),
    ip: text('ip'),
    port: text('port'),
    path: text('path'),
  };
}

export async function savePrinter(
  _previous: ReferenceFormState,
  formData: FormData,
): Promise<ReferenceFormState> {
  formData = actionFormData(_previous, formData);
  const data = read(formData);

  const fieldErrors: Record<string, string> = {};
  for (const [key, field] of [
    ['name', 'name'],
    ['connectionType', 'connection_type'],
    ['charPerLine', 'char_per_line'],
    ['ip', 'ip'],
    ['port', 'port'],
    ['path', 'path'],
  ] as const) {
    if (!data[key]) fieldErrors[field] = `The ${field.replace(/_/g, ' ')} field is required.`;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const user = await authorize(data.id ? 'printer.update' : 'printer.store');

  const values = {
    name: data.name,
    connectionType: data.connectionType,
    charPerLine: data.charPerLine,
    ip: data.ip,
    port: data.port,
    path: data.path,
  };

  try {
    if (data.id) {
      await updatePrinter(data.id, values);
      await successLog(`Printer updated: ${data.id}`, user.id);
      revalidatePath(ROUTES['printer.index']);
      return { success: 'Update Successfully' };
    }
    await createPrinter(values);
    await successLog(`Printer created: ${data.name}`, user.id);
    revalidatePath(ROUTES['printer.index']);
    return { success: 'Model Added Successfully' };
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }
}

export async function deletePrinterAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('printer.delete');

  try {
    await deletePrinter(id);
    await successLog(`Printer deleted: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['printer.index']);
}
