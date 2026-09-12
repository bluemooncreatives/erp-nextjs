'use client';

// The shell the guest forms share: the auth layout renders one of these in its
// left-hand column, as auth/register.blade.php and auth/passwords/*.blade.php
// did inside the guest layout.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@/icons';

export function AuthCard({
  title,
  description,
  backHref = '/login',
  backLabel = 'Back to login',
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          {backLabel}
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto pb-10">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
