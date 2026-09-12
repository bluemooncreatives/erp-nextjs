'use server';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { generateCarryForward, setCarryForward } from '@/lib/hr/carry-forward';

export async function generateCarryForwardAction() {
  await authorize('generate.carry.forward');
  await generateCarryForward();
  revalidatePath('/leave/carry-forward');
}
export async function setCarryForwardAction(form: FormData) {
  await authorize('carry.forward.update');
  await setCarryForward(Number(form.get('id')), form.get('status') === '1');
  revalidatePath('/leave/carry-forward');
}
