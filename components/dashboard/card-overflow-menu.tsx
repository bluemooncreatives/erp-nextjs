"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EllipsisVerticalIcon, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";

export interface CardOverflowMenuProps {
  /**
   * Refresh behaviour. The dashboard is server-rendered, so unlike the source
   * project there is no client-side query to re-run: the default refetches the
   * server component tree, which is the same thing here.
   */
  onRefresh?: () => void;
  /** A "View all" destination, rendered under Refresh. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Additional items after the built-in ones. */
  extra?: ReactNode;
  /** Matches the trigger's a11y label to what the menu actually offers. */
  srLabel?: string;
  className?: string;
}

/** Dashboard card corner menu. */
export function CardOverflowMenu({
  onRefresh,
  viewAllHref,
  viewAllLabel = "View all",
  extra,
  srLabel = "Menu",
  className,
}: CardOverflowMenuProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground size-6 rounded-full", className)}
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">{srLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onRefresh ?? (() => router.refresh())}>
            <RefreshCw className="me-2 size-4" />
            Refresh
          </DropdownMenuItem>
          {viewAllHref ? (
            <DropdownMenuItem asChild>
              <Link href={viewAllHref}>{viewAllLabel}</Link>
            </DropdownMenuItem>
          ) : null}
          {extra}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
