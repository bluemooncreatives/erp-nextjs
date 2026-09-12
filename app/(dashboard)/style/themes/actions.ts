'use server';
import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { changeTheme, findTheme, saveTheme, themeColors } from '@/lib/setting/themes';
import { fileFrom, saveUpload } from '@/lib/uploads';
import type { ReferenceFormState } from '@/components/erp/reference-crud';

export async function saveThemeAction(_prev: ReferenceFormState, form: FormData): Promise<ReferenceFormState> {
  const id = Number(form.get('id') || 0);
  const user = await authorize(id ? 'themes.edit' : 'themes.store');
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const existing = id ? await findTheme(id) : null;
  if (id && !existing) return { error: 'Theme not found.' };
  const definitions = await themeColors();
  const palette = definitions.map((color) => ({ colorId: color.id, value: text(`color_${color.id}`) }));
  if (!text('title') || text('title').length > 191) return { error: 'Enter a title of up to 191 characters.' };
  if (!['solid', 'gradient'].includes(text('color_mode'))) return { error: 'Select a color mode.' };
  if (!['image', 'color'].includes(text('background_type'))) return { error: 'Select a background type.' };
  if (palette.some((color) => !/^#[0-9a-f]{6}$/i.test(color.value))) return { error: 'Select a valid color for every field.' };
  if (!/^#[0-9a-f]{6}$/i.test(text('background_color'))) return { error: 'Select a background color.' };
  let image = existing?.backgroundImage ?? '';
  const file = fileFrom(form, 'background_image');
  if (file) {
    try {
      const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
      if (!['jpeg', 'png'].includes(metadata.format ?? '')) return { error: 'Upload a JPEG or PNG image.' };
      if (!id && (metadata.width !== 1920 || metadata.height !== 1400)) return { error: 'The background image must be 1920 × 1400 pixels.' };
      image = await saveUpload(file, 'backgroundImage') ?? '';
    } catch { return { error: 'Could not read the background image.' }; }
  }
  if (text('background_type') === 'image' && !image) return { error: 'Upload a background image.' };
  await saveTheme(id || null, { title: text('title'), colorMode: text('color_mode'), backgroundType: text('background_type'), backgroundColor: text('background_color'), backgroundImage: image, isDefault: form.get('is_default') ? 1 : 0, createdBy: user.id }, palette);
  revalidatePath('/', 'layout');
  redirect('/style/themes');
}
export async function themeOperation(form: FormData) {
  const operation = String(form.get('operation'));
  if (operation !== 'copy' && operation !== 'default' && operation !== 'delete') throw new Error('Invalid theme operation');
  const user = await authorize(operation === 'delete' ? 'themes.destroy' : `themes.${operation}`);
  await changeTheme(Number(form.get('id')), operation, user.id);
  revalidatePath('/', 'layout');
}
