import { notFound } from 'next/navigation';
import { authorize } from '@/lib/auth/permissions';
import { findTheme, themeColors } from '@/lib/setting/themes';
import { PageHeader } from '@/components/erp/page';
import { ThemeForm } from '../../form';
export default async function EditThemePage({ params }: { params: Promise<{ id: string }> }) {
  await authorize('themes.edit');
  const id = Number((await params).id);
  const theme = Number.isSafeInteger(id) && id > 0 ? await findTheme(id) : null;
  if (!theme) notFound();
  return <><PageHeader title="Edit Theme" /><ThemeForm theme={theme} colors={await themeColors(id)} /></>;
}
