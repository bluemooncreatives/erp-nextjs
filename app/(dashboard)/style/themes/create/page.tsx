import { authorize } from '@/lib/auth/permissions';
import { themeColors } from '@/lib/setting/themes';
import { PageHeader } from '@/components/erp/page';
import { ThemeForm } from '../form';
export default async function CreateThemePage() {
  await authorize('themes.store');
  return <><PageHeader title="Create Theme" /><ThemeForm colors={await themeColors()} /></>;
}
