'use client';

// The signed-in user's menu - profile, change password and logout, the same
// three entries the Blade header carried.

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/app/(auth)/actions';
import { ROUTES } from '@/lib/routes';

export default function UserDropdown({
  name,
  roleName,
  email,
  avatar,
}: {
  name: string;
  roleName: string;
  email: string | null;
  avatar: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-muted flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-7">
          {/* `next/image` keeps the avatar served through the same optimiser
              the rest of the app uses; `asChild` lets Avatar wrap it. */}
          <AvatarImage asChild src={avatar} alt={name}>
            <Image src={avatar} alt={name} width={28} height={28} unoptimized />
          </AvatarImage>
          <AvatarFallback>{initials || '?'}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate font-medium sm:block">{name}</span>
        <ChevronDown className="text-muted-foreground size-4" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{name}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {email ?? roleName}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={ROUTES['profile_view']}>
            <UserRound />
            Edit profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ROUTES['change_password']}>
            <KeyRound />
            Change password
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* A form post, not a link: signing out clears the session cookie
            server-side and must not be reachable by prefetch. */}
        <form action={logout}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
