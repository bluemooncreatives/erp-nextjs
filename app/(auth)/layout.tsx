// Guest shell - TailAdmin's split auth layout, using the branding configured in
// `general_settings` (logo, company name) the way
// resources/views/auth/layouts/guest.blade.php did.

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import GridShape from '@/components/common/GridShape';
import ThemeTogglerTwo from '@/components/common/ThemeTogglerTwo';
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
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col dark:bg-gray-900 sm:p-0">
        {children}

        <div className="lg:w-1/2 w-full h-full bg-brand-950 dark:bg-white/5 lg:grid items-center hidden">
          <div className="relative items-center justify-center flex z-1">
            <GridShape />
            <div className="flex flex-col items-center max-w-xs">
              <Link href="/login" className="block mb-4">
                {logo ? (
                  <Image
                    width={231}
                    height={48}
                    src={logo}
                    alt={companyName}
                    unoptimized
                  />
                ) : (
                  <span className="text-2xl font-semibold text-white">
                    {companyName}
                  </span>
                )}
              </Link>
              <p className="text-center text-gray-400 dark:text-white/60">
                Sales, purchasing, inventory, accounting and HR in one place.
              </p>
            </div>
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
