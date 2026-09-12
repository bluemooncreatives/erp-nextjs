'use client';

// ---------------------------------------------------------------------------
// Sidebar - the design system's collapsible sidebar, driven by the ERP's
// permission-filtered navigation instead of a hard-coded menu.
//
// The menu tree is resolved on the server (app/(dashboard)/layout.tsx) by
// applying the same `permissionCheck()` rules the Blade menu partials used, so
// this component only handles expansion and active state.
// ---------------------------------------------------------------------------

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { NAV_ICONS } from './nav-icons';

export type SidebarLink = { kind: 'link'; label: string; href: string };
export type SidebarHeading = { kind: 'heading'; label: string };

export type SidebarGroupItem = {
  kind: 'group';
  label: string;
  icon: string;
  match: string[];
  children: Array<SidebarLink | SidebarHeading>;
};

export type SidebarItem = SidebarLink | SidebarGroupItem;

export default function AppSidebar({
  items,
  logo,
  siteTitle,
}: {
  items: SidebarItem[];
  logo: string | null;
  /** Kept for the server layout's call signature; the same file serves both themes. */
  logoDark?: string | null;
  siteTitle: string;
}) {
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => pathname === href.split('?')[0],
    [pathname],
  );

  // The group holding the current page, matching the Blade `mm-active`. It is
  // derived rather than stored, so navigating always reopens the right section.
  const activeGroup = useMemo(() => {
    let found: number | null = null;
    items.forEach((item, index) => {
      if (item.kind !== 'group') return;
      const inSection =
        item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)) ||
        item.children.some((c) => c.kind === 'link' && isActive(c.href));
      if (inSection) found = index;
    });
    return found;
  }, [items, pathname, isActive]);

  // A click records an override; moving to another page discards it.
  const [override, setOverride] = useState<{
    pathname: string;
    index: number | null;
  } | null>(null);

  const openGroup =
    override && override.pathname === pathname ? override.index : activeGroup;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-[49px] justify-center border-b px-3">
        <Link href="/home" className="flex items-center gap-2 overflow-hidden">
          {logo ? (
            <Image
              src={logo}
              alt={siteTitle}
              width={132}
              height={28}
              className="h-7 w-auto object-contain group-data-[collapsible=icon]:hidden"
              unoptimized
            />
          ) : (
            <span className="text-sidebar-foreground truncate text-base font-semibold group-data-[collapsible=icon]:hidden">
              {siteTitle}
            </span>
          )}
          {/* The collapsed rail keeps a mark where the logo was. */}
          <span className="bg-sidebar-primary text-sidebar-primary-foreground hidden size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold group-data-[collapsible=icon]:flex">
            {siteTitle.trim().charAt(0).toUpperCase() || 'I'}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="minimal-scrollbar">
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item, index) =>
              item.kind === 'link' ? (
                <SidebarMenuItem key={`${item.label}-${index}`}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                <NavGroup
                  key={`${item.label}-${index}`}
                  item={item}
                  open={openGroup === index}
                  onOpenChange={(next) =>
                    setOverride({ pathname, index: next ? index : null })
                  }
                  isActive={isActive}
                />
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

function NavGroup({
  item,
  open,
  onOpenChange,
  isActive,
}: {
  item: SidebarGroupItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isActive: (href: string) => boolean;
}) {
  const Icon = NAV_ICONS[item.icon];
  const hasActiveChild = item.children.some(
    (child) => child.kind === 'link' && isActive(child.href),
  );

  return (
    <Collapsible asChild open={open} onOpenChange={onOpenChange}>
      {/* `group/collapsible` is what the chevron's rotate selector below
          matches on - with `asChild`, Collapsible's `data-state` lands on this
          element, so the group has to be named here. */}
      <SidebarMenuItem className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.label}
            isActive={hasActiveChild && !open}
          >
            {Icon ? <Icon /> : null}
            <span className="truncate">{item.label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child, index) =>
              child.kind === 'heading' ? (
                <SidebarGroupLabel
                  key={`${child.label}-${index}`}
                  className="h-7 px-2 text-2xs"
                >
                  {child.label}
                </SidebarGroupLabel>
              ) : (
                <SidebarMenuSubItem key={`${child.label}-${index}`}>
                  <SidebarMenuSubButton asChild isActive={isActive(child.href)}>
                    <Link href={child.href}>
                      <span className="truncate">{child.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ),
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
