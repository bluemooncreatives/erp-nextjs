// `company_info` - HomeController@company renders `setting::index` with
// `$company` set; the Blade reads that flag only to mark the Company tab
// active, so this is the settings screen opened on that tab.

import type { Metadata } from 'next';
import { SettingsScreen } from '../setting/page';

export const metadata: Metadata = { title: 'Company Information' };

export default async function CompanyInfoPage() {
  return <SettingsScreen initialTab="company" />;
}
