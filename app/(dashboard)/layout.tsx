// ---------------------------------------------------------------------------
// Authenticated shell - the TailAdmin admin layout, fed by the ERP.
//
// Replaces resources/views/backEnd/master.blade.php. The navigation is filtered
// with the same `permissionCheck()` rules the Blade menu partials used, and the
// header controls (branch, language, notifications, user menu) come from the
// same tables the PHP header read.
// ---------------------------------------------------------------------------

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { languages, notifications, showRooms } from '@/lib/db/schema';
import { requireUser, userCan, userCanAny } from '@/lib/auth/permissions';
import { generalSetting } from '@/lib/settings';
import { assetUrl, avatarUrl } from '@/lib/paths';
import { getSession } from '@/lib/auth/session';
import { NAVIGATION, navHref, navPermission } from '@/lib/navigation';
import { unreadNotificationCount } from '@/lib/notifications';
import { AdminShell } from './admin-shell';
import { themeList, themeColors } from '@/lib/setting/themes';
import { themeStyle } from '@/lib/setting/theme-style';
import type { SidebarItem, SidebarLink, SidebarHeading } from '@/layout/AppSidebar';

// Every screen reads live data for the signed-in user, exactly as the PHP
// stack rendered each request. Nothing here is prerenderable.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const session = await getSession();
  const setting = await generalSetting();
  const currentTheme = (await themeList()).find((theme) => theme.isDefault === 1);
  const appearance = currentTheme ? themeStyle(currentTheme, await themeColors(currentTheme.id)) : undefined;

  const nav = resolveNavigation(user);

  const branches =
    user.role.type === 'system_user'
      ? await db
          .select({ id: showRooms.id, name: showRooms.name })
          .from(showRooms)
          .where(eq(showRooms.status, 1))
      : user.showroomId && user.showroomName
        ? [{ id: user.showroomId, name: user.showroomName }]
        : [];

  const activeLanguages = userCan(user, 'language.change')
    ? (
        await db
          .select({ code: languages.code, name: languages.name })
          .from(languages)
          .where(eq(languages.status, 1))
      ).map((l) => ({ code: l.code ?? 'en', name: l.name ?? l.code ?? 'en' }))
    : [];

  const showNotifications = user.role.type !== 'normal_user';

  const recent = showNotifications
    ? await db
        .select({
          id: notifications.id,
          type: notifications.type,
          data: notifications.data,
          url: notifications.url,
          createdAt: notifications.createdAt,
          readAt: notifications.readAt,
        })
        .from(notifications)
        .orderBy(desc(notifications.id))
        .limit(10)
    : [];

  const unread = showNotifications ? await unreadNotificationCount(user.id) : 0;

  return (
    <AdminShell
      appearance={appearance}
      nav={nav}
      logo={assetUrl(setting.logo)}
      logoDark={assetUrl(setting.logo)}
      siteTitle={setting.siteTitle ?? setting.companyName ?? 'Infix Biz'}
      user={{
        name: user.name,
        roleName: user.role.name,
        email: user.email,
        avatar: avatarUrl(user.avatar ?? user.photo, user.name),
      }}
      branches={branches}
      currentBranchId={session?.showroomId ?? user.showroomId}
      canSwitchBranch={user.role.type === 'system_user'}
      languages={activeLanguages}
      currentLocale={session?.locale ?? setting.languageName ?? 'en'}
      notifications={recent}
      unreadCount={unread}
      showNotifications={showNotifications}
    >
      {children}
    </AdminShell>
  );
}

/**
 * Apply `permissionCheck()` to the navigation tree, dropping groups that end up
 * with no visible children - what the nested `@if` blocks in the Blade menu
 * partials produced.
 */
function resolveNavigation(
  user: Awaited<ReturnType<typeof requireUser>>,
): SidebarItem[] {
  const out: SidebarItem[] = [];

  for (const item of NAVIGATION) {
    if (item.kind === 'link') {
      if (!userCan(user, navPermission(item))) continue;
      out.push({ kind: 'link', label: item.label, href: navHref(item) });
      continue;
    }

    const childPermissions = item.children
      .filter((c): c is Extract<typeof c, { kind: 'link' }> => c.kind === 'link')
      .map((c) => navPermission(c));

    if (!userCan(user, item.permission) && !userCanAny(user, childPermissions)) {
      continue;
    }

    const children: Array<SidebarLink | SidebarHeading> = [];
    for (const child of item.children) {
      if (child.kind === 'heading') {
        children.push({ kind: 'heading', label: child.label });
        continue;
      }
      if (!userCan(user, navPermission(child))) continue;
      children.push({ kind: 'link', label: child.label, href: navHref(child) });
    }

    // Drop headings left with nothing under them.
    const pruned = children.filter((c, i) => {
      if (c.kind !== 'heading') return true;
      const next = children[i + 1];
      return next != null && next.kind === 'link';
    });

    if (!pruned.some((c) => c.kind === 'link')) continue;

    out.push({
      kind: 'group',
      label: item.label,
      icon: item.icon,
      match: item.match,
      children: pruned,
    });
  }

  return out;
}
