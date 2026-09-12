// Guest shell - a centred card on the design system's auth wash, using the
// branding configured in `general_settings` (logo, company name) the way
// resources/views/auth/layouts/guest.blade.php did.

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { ThemeToggleButton } from '@/components/common/ThemeToggleButton';
import { generalSetting } from '@/lib/settings';
import { assetUrl } from '@/lib/paths';

// Reads live settings each request, as the PHP stack did; never prerendered.
export const dynamic = 'force-dynamic';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setting = await generalSetting();
  const logo = assetUrl(setting.logo);
  const companyName = setting.companyName || setting.siteTitle || 'Infix Biz';

  return (
    // `admin-auth-shell` is the design system's soft radial wash, so the form
    // does not sit on a bare white page.
    <div className="admin-auth-shell flex min-h-screen flex-col">
      <div className="flex items-center justify-between p-4 sm:p-6">
        <Link href="/login" className="flex items-center gap-2">
          {logo ? (
            <Image
              src={logo}
              alt={companyName}
              width={160}
              height={34}
              className="h-8 w-auto object-contain"
              unoptimized
            />
          ) : (
            <span className="text-lg font-semibold">{companyName}</span>
          )}
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
