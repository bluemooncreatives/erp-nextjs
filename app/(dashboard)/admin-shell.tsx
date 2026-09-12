'use client';

// The TailAdmin AdminLayout frame (sidebar + backdrop + header + content),
// taking its data from the server layout.

import React from 'react';
import { useSidebar } from '@/context/SidebarContext';
import AppHeader, { type HeaderUser } from '@/layout/AppHeader';
import AppSidebar, { type SidebarItem } from '@/layout/AppSidebar';
import Backdrop from '@/layout/Backdrop';
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
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
      ? 'lg:ml-[290px]'
      : 'lg:ml-[90px]';

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar
        items={nav}
        logo={logo}
        logoDark={logoDark}
        siteTitle={siteTitle}
      />
      <Backdrop />

      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader
          user={user}
          branches={branches}
          currentBranchId={currentBranchId}
          canSwitchBranch={canSwitchBranch}
          languages={languages}
          currentLocale={currentLocale}
          notifications={notifications}
          unreadCount={unreadCount}
          logo={logo}
          logoDark={logoDark}
          siteTitle={siteTitle}
          showNotifications={showNotifications}
        />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
      </div>
    </div>
  );
}
