'use server';
import { actionFormData } from '@/lib/forms';
import { revalidatePath } from 'next/cache';
import { changeField, saveField, saveFieldValue } from '@/lib/project/fields';

export type FieldState = { error?: string; success?: string };
export async function updateFieldAction(_previous: FieldState, data: FormData): Promise<FieldState> {
  data = actionFormData(_previous, data);
  try {
    const projectId = Number(data.get('project_id'));
    const fieldId = Number(data.get('field_id'));
    const operation = String(data.get('operation') ?? 'save');
    if (operation === 'value') await saveFieldValue(projectId, Number(data.get('task_id')), fieldId, String(data.get('value') ?? ''));
    else if (operation === 'save') await saveField(projectId, data);
    else await changeField(projectId, fieldId, operation);
    revalidatePath('/project', 'layout');
    revalidatePath('/task', 'layout');
    return { success: 'Saved.' };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to save field.' }; }
}
