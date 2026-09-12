'use client';

// ---------------------------------------------------------------------------
// Sidebar - the TailAdmin sidebar, driven by the ERP's permission-filtered
// navigation instead of the template's hard-coded demo menu.
//
// The menu tree is resolved on the server (app/(dashboard)/layout.tsx) by
// applying the same `permissionCheck()` rules the Blade menu partials used, so
// this component only handles expansion, hover-collapse and active state.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';
import { ChevronDownIcon, HorizontaLDots } from '@/icons/index';
import { NAV_ICONS } from './nav-icons';

export type SidebarLink = { kind: 'link'; label: string; href: string };
export type SidebarHeading = { kind: 'heading'; label: string };

export type SidebarGroup = {
  kind: 'group';
  label: string;
  icon: string;
  match: string[];
  children: Array<SidebarLink | SidebarHeading>;
};

export type SidebarItem = SidebarLink | SidebarGroup;

export default function AppSidebar({
  items,
  logo,
  logoDark,
  siteTitle,
}: {
  items: SidebarItem[];
  logo: string | null;
  logoDark: string | null;
  siteTitle: string;
}) {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<number, number>>({});
  const subMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => pathname === path.split('?')[0],
    [pathname],
  );

  // Open the group that owns the current page, matching the Blade `mm-active`.
  useEffect(() => {
    let matched = false;
    items.forEach((nav, index) => {
      if (nav.kind !== 'group') return;
      const inSection =
        nav.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)) ||
        nav.children.some((c) => c.kind === 'link' && isActive(c.href));
      if (inSection) {
        setOpenSubmenu(index);
        matched = true;
      }
    });
    if (!matched) setOpenSubmenu(null);
  }, [pathname, items, isActive]);

  useEffect(() => {
    if (openSubmenu === null) return;
    const el = subMenuRefs.current[openSubmenu];
    if (el) {
      setSubMenuHeight((prev) => ({ ...prev, [openSubmenu]: el.scrollHeight }));
    }
  }, [openSubmenu, items]);

  const toggleSubmenu = (index: number) =>
    setOpenSubmenu((prev) => (prev === index ? null : index));

  const showLabels = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? 'w-[290px]' : isHovered ? 'w-[290px]' : 'w-[90px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${!isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'}`}
      >
        <Link href="/home">
          {showLabels ? (
            logo ? (
              <>
                <Image
                  className="dark:hidden"
                  src={logo}
                  alt={siteTitle}
                  width={150}
                  height={40}
                  unoptimized
                />
                <Image
                  className="hidden dark:block"
                  src={logoDark ?? logo}
                  alt={siteTitle}
                  width={150}
                  height={40}
                  unoptimized
                />
              </>
            ) : (
              <span className="text-xl font-semibold text-gray-800 dark:text-white/90">
                {siteTitle}
              </span>
            )
          ) : logo ? (
            <Image src={logo} alt={siteTitle} width={32} height={32} unoptimized />
          ) : (
            <span className="text-xl font-bold text-brand-500">
              {siteTitle.charAt(0)}
            </span>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !showLabels ? 'lg:justify-center' : 'justify-start'
                }`}
              >
                {showLabels ? 'Menu' : <HorizontaLDots />}
              </h2>

              <ul className="flex flex-col gap-4">
                {items.map((nav, index) => (
                  <li key={nav.kind === 'group' ? nav.label : nav.href}>
                    {nav.kind === 'group' ? (
                      <button
                        onClick={() => toggleSubmenu(index)}
                        className={`menu-item group ${
                          openSubmenu === index ? 'menu-item-active' : 'menu-item-inactive'
                        } cursor-pointer ${
                          !showLabels ? 'lg:justify-center' : 'lg:justify-start'
                        }`}
                      >
                        <span
                          className={
                            openSubmenu === index
                              ? 'menu-item-icon-active'
                              : 'menu-item-icon-inactive'
                          }
                        >
                          {renderIcon(nav.icon)}
                        </span>
                        {showLabels && <span className="menu-item-text">{nav.label}</span>}
                        {showLabels && (
                          <ChevronDownIcon
                            className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                              openSubmenu === index ? 'rotate-180 text-brand-500' : ''
                            }`}
                          />
                        )}
                      </button>
                    ) : (
                      <Link
                        href={nav.href}
                        className={`menu-item group ${
                          isActive(nav.href) ? 'menu-item-active' : 'menu-item-inactive'
                        } ${!showLabels ? 'lg:justify-center' : 'lg:justify-start'}`}
                      >
                        <span
                          className={
                            isActive(nav.href)
                              ? 'menu-item-icon-active'
                              : 'menu-item-icon-inactive'
                          }
                        >
                          {renderIcon('grid')}
                        </span>
                        {showLabels && <span className="menu-item-text">{nav.label}</span>}
                      </Link>
                    )}

                    {nav.kind === 'group' && showLabels && (
                      <div
                        ref={(el) => {
                          subMenuRefs.current[index] = el;
                        }}
                        className="overflow-hidden transition-all duration-300"
                        style={{
                          height:
                            openSubmenu === index ? `${subMenuHeight[index] ?? 0}px` : '0px',
                        }}
                      >
                        <ul className="mt-2 space-y-1 ml-9">
                          {nav.children.map((child, ci) =>
                            child.kind === 'heading' ? (
                              <li
                                key={`h-${child.label}-${ci}`}
                                className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                              >
                                {child.label}
                              </li>
                            ) : (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  className={`menu-dropdown-item ${
                                    isActive(child.href)
                                      ? 'menu-dropdown-item-active'
                                      : 'menu-dropdown-item-inactive'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}

function renderIcon(name: string) {
  const Icon = NAV_ICONS[name] ?? NAV_ICONS.grid;
  return <Icon />;
}
