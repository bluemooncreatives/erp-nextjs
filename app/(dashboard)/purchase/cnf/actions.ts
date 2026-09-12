'use server';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { cnfRepository } from '@/lib/purchase/cnf';
import { successLog, errorLog } from '@/lib/activity-log';
import type { ReferenceFormState } from '@/components/erp/reference-crud';

export async function saveCnf(_previous: ReferenceFormState, form: FormData): Promise<ReferenceFormState> {
  const id = Number(form.get('id') || 0);
  const user = await authorize(id ? 'cnf.edit' : 'cnf.store');
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const values = { name: text('name'), email: text('email') || null, phone: text('phone') || null, address: text('address') || null, status: text('status') === '0' ? 0 : 1, createdBy: user.id };
  if (!values.name || values.name.length > 255) return { fieldErrors: { name: 'Enter a name of up to 255 characters.' } };
  if ([values.email, values.phone, values.address].some((value) => value && value.length > 255)) return { error: 'Fields must not exceed 255 characters.' };
  try {
    if (id) {
      if (!await cnfRepository.find(id)) return { error: 'CNF not found.' };
      await cnfRepository.update(id, values, user.id);
    } else await cnfRepository.create(values, user.id);
    await successLog(`CNF ${id ? 'updated' : 'created'}: ${values.name}`, user.id);
    revalidatePath('/purchase/cnf');
    return { success: 'CNF saved successfully.' };
  } catch (error) { await errorLog(String(error), user.id); return { error: 'Something Went Wrong' }; }
}

export async function deleteCnf(form: FormData) {
  const user = await authorize('cnf.delete');
  await cnfRepository.remove(Number(form.get('id')));
  await successLog('CNF deleted', user.id);
  revalidatePath('/purchase/cnf');
}
