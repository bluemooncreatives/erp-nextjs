'use client';

// ---------------------------------------------------------------------------
// Header - the ERP's controls on the design system's primitives:
//
//   * menu search        -> HomeController@menuSearch (searches `permissions`)
//   * branch selector    -> session('showroom_id'), from the Blade header
//   * language selector  -> LanguageController@change
//   * notifications      -> the `notifications` table
//   * user dropdown      -> profile / change password / logout
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { ThemeToggleButton } from '@/components/common/ThemeToggleButton';
import NotificationDropdown from '@/components/header/NotificationDropdown';
import UserDropdown from '@/components/header/UserDropdown';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { switchShowroom } from '@/app/(auth)/actions';
import { changeLocale } from '@/app/(dashboard)/locale-actions';
import { searchMenu, type MenuSearchResult } from '@/app/(dashboard)/search-actions';

export type HeaderUser = {
  name: string;
  roleName: string;
  email: string | null;
  avatar: string;
};

export default function AppHeader({
  user,
  branches,
  currentBranchId,
  canSwitchBranch,
  languages,
  currentLocale,
  notifications,
  unreadCount,
  showNotifications,
}: {
  user: HeaderUser;
  branches: Array<{ id: number; name: string }>;
  currentBranchId: number | null;
  canSwitchBranch: boolean;
  languages: Array<{ code: string; name: string }>;
  currentLocale: string;
  notifications: Array<{
    id: number;
    type: string | null;
    data: string | null;
    url: string | null;
    createdAt: Date | null;
    readAt: Date | null;
  }>;
  unreadCount: number;
  logo?: string | null;
  logoDark?: string | null;
  siteTitle?: string;
  showNotifications: boolean;
}) {
  return (
    // `h-[49px]` rather than `h-12`: with border-box sizing the border is part
    // of the height, so 48 + 1 keeps this content row level with the sidebar
    // header's own 48px row and puts both borders on the same line.
    <header className="bg-card sticky top-0 z-40 h-[49px] border-b">
      <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="[&_svg]:size-5!" />
          <Separator orientation="vertical" className="hidden h-4! self-center sm:block" />
          <MenuSearch />
        </div>

        <div className="flex items-center gap-1.5">
          <BranchSelect
            branches={branches}
            current={currentBranchId}
            editable={canSwitchBranch}
          />
          <LanguageSelect languages={languages} current={currentLocale} />
          <ThemeToggleButton />
          {showNotifications ? (
            <NotificationDropdown items={notifications} unreadCount={unreadCount} />
          ) : null}
          <UserDropdown
            name={user.name}
            roleName={user.roleName}
            email={user.email}
            avatar={user.avatar}
          />
        </div>
      </div>
    </header>
  );
}

/** `HomeController@menuSearch` - live search over permission names. */
function MenuSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MenuSearchResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchMenu(term);
      if (!cancelled) setResults(found);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // Whether a short term shows anything is a render-time decision; clearing the
  // state from the effect would only cost an extra render pass.
  const visible = term.length < 2 ? [] : results;

  return (
    <div className="relative hidden md:block">
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search or type command..."
        aria-label="Search menu"
        className="h-9 w-64 pr-14 pl-9 lg:w-80"
      />
      <kbd className="text-muted-foreground bg-muted pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[10px] lg:inline-flex">
        <span>⌘</span>
        <span>K</span>
      </kbd>

      {open && visible.length > 0 ? (
        <div className="bg-popover text-popover-foreground absolute right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border shadow-md">
          <ul className="minimal-scrollbar max-h-80 overflow-y-auto py-1">
            {visible.map((result) => (
              <li key={`${result.route}-${result.name}`}>
                <Link
                  href={result.href}
                  className="hover:bg-muted block px-3 py-2 text-sm"
                >
                  {result.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BranchSelect({
  branches,
  current,
  editable,
}: {
  branches: Array<{ id: number; name: string }>;
  current: number | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!branches.length) return null;

  if (!editable) {
    return (
      <span className="text-muted-foreground hidden px-2 text-sm sm:block">
        {branches.find((branch) => branch.id === current)?.name ?? 'Login Again'}
      </span>
    );
  }

  return (
    <Select
      disabled={pending}
      defaultValue={current == null ? undefined : String(current)}
      onValueChange={(value) => {
        startTransition(async () => {
          await switchShowroom(Number(value));
          router.refresh();
        });
      }}
    >
      <SelectTrigger aria-label="Branch" className="hidden h-9 w-40 sm:flex">
        <SelectValue placeholder="Branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={String(branch.id)}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LanguageSelect({
  languages,
  current,
}: {
  languages: Array<{ code: string; name: string }>;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (languages.length < 2) return null;

  return (
    <Select
      disabled={pending}
      defaultValue={current}
      onValueChange={(code) => {
        startTransition(async () => {
          await changeLocale(code);
          router.refresh();
        });
      }}
    >
      <SelectTrigger aria-label="Language" className="hidden h-9 w-32 sm:flex">
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        {languages.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            {language.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
