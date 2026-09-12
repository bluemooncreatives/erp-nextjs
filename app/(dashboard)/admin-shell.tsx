'use client';

// The authenticated frame: sidebar + header + content, taking its data from the
// server layout. `SidebarProvider` lives here rather than in the root layout
// because only the authenticated surfaces have a sidebar - and `Sidebar` and
// `SidebarInset` must stay its direct children for the collapse selectors to
// match.

import React from 'react';
import AppHeader, { type HeaderUser } from '@/layout/AppHeader';
import AppSidebar, { type SidebarItem } from '@/layout/AppSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { HeaderNotification } from '@/components/header/NotificationDropdown';

export function AdminShell({
  nav,
  logo,
  logoDark,
  siteTitle,
  user,
  branches,
  currentBranchId,
  canSwitchBranch,
  languages,
  currentLocale,
  notifications,
  unreadCount,
  showNotifications,
  children,
  appearance,
}: {
  nav: SidebarItem[];
  logo: string | null;
  logoDark: string | null;
  siteTitle: string;
  user: HeaderUser;
  branches: Array<{ id: number; name: string }>;
  currentBranchId: number | null;
  canSwitchBranch: boolean;
  languages: Array<{ code: string; name: string }>;
  currentLocale: string;
  notifications: HeaderNotification[];
  unreadCount: number;
  showNotifications: boolean;
  children: React.ReactNode;
  appearance?: React.CSSProperties;
}) {
  return (
    // `erp-theme` is where the saved Appearance palette lands; globals.css
    // feeds those `--erp-*` values into the design tokens.
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="erp-theme" style={appearance}>
        <a
          href="#main"
          className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>

        <AppSidebar
          items={nav}
          logo={logo}
          logoDark={logoDark}
          siteTitle={siteTitle}
        />

        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            user={user}
            branches={branches}
            currentBranchId={currentBranchId}
            canSwitchBranch={canSwitchBranch}
            languages={languages}
            currentLocale={currentLocale}
            notifications={notifications}
            unreadCount={unreadCount}
            showNotifications={showNotifications}
          />
          <div id="main" className="mx-auto w-full max-w-360 flex-1 p-4 sm:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
