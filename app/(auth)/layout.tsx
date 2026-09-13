// Guest shell - a centred card on the design system's auth wash, using the
// branding configured in `general_settings` (logo, company name) the way
// resources/views/auth/layouts/guest.blade.php did.

import Link from 'next/link';
import React from 'react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { ThemeToggleButton } from '@/components/common/ThemeToggleButton';
import { generalSetting } from '@/lib/settings';
import { uploadedAssetUrl } from '@/lib/paths';
import { themeColors, themeList } from '@/lib/setting/themes';
import { themeStyle } from '@/lib/setting/theme-style';

// Reads live settings each request, as the PHP stack did; never prerendered.
export const dynamic = 'force-dynamic';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setting = await generalSetting();
  const logo = uploadedAssetUrl(setting.logo);
  const companyName = setting.companyName || setting.siteTitle || 'Infix Biz';

  // The Blade guest layout was themed too, so the login screen matches the
  // palette an admin picked rather than reverting to the shipped colours.
  const currentTheme = (await themeList()).find((theme) => theme.isDefault === 1);
  const appearance = currentTheme
    ? themeStyle(currentTheme, await themeColors(currentTheme.id))
    : undefined;

  return (
    // `admin-auth-shell` is the design system's soft radial wash, so the form
    // does not sit on a bare white page.
    <div className="erp-theme admin-auth-shell flex min-h-screen flex-col" style={appearance}>
      <div className="flex items-center justify-between p-4 sm:p-6">
        <Link href="/login" className="flex items-center gap-2">
          <BrandLogo
            src={logo}
            name={companyName}
            width={160}
            height={34}
            className="h-8 w-auto object-contain"
          />
        </Link>
        <ThemeToggleButton />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="text-muted-foreground px-4 pb-6 text-center text-xs sm:px-6">
        Sales, purchasing, inventory, accounting and HR in one place.
      </footer>
    </div>
  );
}
