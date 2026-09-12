import 'server-only';
import { eq } from 'drizzle-orm';
import { db, transaction } from '@/lib/db/client';
import { colors, colorTheme, themes, type NewThemes } from '@/lib/db/schema';

export async function themeList() { return db.select().from(themes).orderBy(themes.id); }
export async function themeColors(id?: number) {
  const all = await db.select().from(colors).orderBy(colors.id);
  const values = id ? await db.select().from(colorTheme).where(eq(colorTheme.themeId, id)) : [];
  return all.map((color) => ({ ...color, value: values.find((item) => item.colorId === color.id)?.value ?? color.defaultValue ?? '#000000' }));
}
export async function findTheme(id: number) {
  const [theme] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  return theme ?? null;
}
export async function saveTheme(id: number | null, data: NewThemes, palette: { colorId: number; value: string }[]) {
  return transaction(async (tx) => {
    let themeId = id;
    if (id) {
      const [existing] = await tx.select().from(themes).where(eq(themes.id, id)).limit(1);
      if (!existing) throw new Error('Theme not found');
      // PHP update does not change is_default or created_by.
      const { isDefault: _default, createdBy: _creator, ...editable } = data;
      void _default; void _creator;
      await tx.update(themes).set({ ...editable, updatedAt: new Date() }).where(eq(themes.id, id));
    } else {
      if (data.isDefault) await tx.update(themes).set({ isDefault: 0 }).where(eq(themes.isDefault, 1));
      const [created] = await tx.insert(themes).values({ ...data, createdAt: new Date(), updatedAt: new Date() });
      themeId = Number(created.insertId);
    }
    await tx.delete(colorTheme).where(eq(colorTheme.themeId, themeId!));
    if (palette.length) await tx.insert(colorTheme).values(palette.map((color) => ({ ...color, themeId: themeId! })));
    return themeId!;
  });
}
export async function changeTheme(id: number, operation: 'copy' | 'default' | 'delete', userId: number) {
  await transaction(async (tx) => {
    const [theme] = await tx.select().from(themes).where(eq(themes.id, id)).limit(1);
    if (!theme) throw new Error('Theme not found');
    if (operation === 'copy') {
      const { id: _id, ...source } = theme; void _id;
      const [created] = await tx.insert(themes).values({ ...source, title: `Clone of ${theme.title}`, isDefault: 0, createdBy: userId, createdAt: new Date(), updatedAt: new Date() });
      const palette = await tx.select().from(colorTheme).where(eq(colorTheme.themeId, id));
      if (palette.length) await tx.insert(colorTheme).values(palette.map((color) => ({ ...color, themeId: Number(created.insertId) })));
    } else if (operation === 'default') {
      await tx.update(themes).set({ isDefault: 0 }).where(eq(themes.isDefault, 1));
      await tx.update(themes).set({ isDefault: 1, updatedAt: new Date() }).where(eq(themes.id, id));
    } else {
      if (id === 1) throw new Error('The system theme cannot be deleted.');
      if (theme.isDefault) await tx.update(themes).set({ isDefault: 1 }).where(eq(themes.id, 1));
      await tx.delete(colorTheme).where(eq(colorTheme.themeId, id));
      await tx.delete(themes).where(eq(themes.id, id));
    }
  });
}
