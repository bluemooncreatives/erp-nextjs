'use server';
import { revalidatePath } from 'next/cache';
import { moveProjectItem } from '@/lib/project/ordering';

export async function reorderProjectItem(data: FormData): Promise<{ error?: string }> {
  try {
    await moveProjectItem(Number(data.get('project_id')), String(data.get('kind')), Number(data.get('id')), data.get('target') === '' ? null : Number(data.get('target')), Number(data.get('position')));
    revalidatePath('/project', 'layout'); revalidatePath('/task', 'layout');
    return {};
  } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to move item.' }; }
}
