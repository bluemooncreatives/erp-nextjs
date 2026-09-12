import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

/** Recurring cell shapes (identity, secondary value, currency, date) — each was previously re-written inline per table with drifting scales. */

/** Initials from a display name, capped at two letters. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Identity cell: the thing the row is *about*. */
export function PrimaryCell({
  title,
  subtitle,
  avatarUrl,
  showAvatar = true,
  icon,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  avatarUrl?: string;
  showAvatar?: boolean;
  /** Replaces the avatar — for rows that are objects rather than people. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
      ) : showAvatar ? (
        <Avatar className="size-9 shrink-0">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-xs">{initialsOf(title)}</AvatarFallback>
        </Avatar>
      ) : null}
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

/** `PrimaryCell`'s loading placeholder — row content only, no wrapper, so it drops into the caller's own skeleton-row container. */
export function PrimaryCellSkeleton({ trailing }: { trailing?: ReactNode }) {
  return (
    <>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      {trailing !== undefined ? trailing : <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />}
    </>
  );
}

/** Secondary value — the default treatment for non-identity columns. */
export function MetaText({
  children,
  className,
  muted = true,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span className={cn("text-sm", muted ? "text-muted-foreground" : "text-foreground", className)}>
      {children}
    </span>
  );
}

export function MoneyCell({
  amount,
  currency = "USD",
  className,
}: {
  amount: number | null | undefined;
  currency?: string;
  className?: string;
}) {
  if (amount == null) return <MetaText className={className}>-</MetaText>;
  return (
    <span className={cn("font-medium tabular-nums text-foreground", className)}>
      {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)}
    </span>
  );
}

export function DateCell({
  value,
  className,
}: {
  /** ISO string, Date, or an already-formatted label. */
  value: string | Date | null | undefined;
  className?: string;
}) {
  if (!value) return <MetaText className={className}>-</MetaText>;

  const date = value instanceof Date ? value : new Date(value);
  // Screens still carry pre-formatted mock strings ("May 28, 2026"); render
  // those as-is rather than turning them into "Invalid Date".
  if (Number.isNaN(date.getTime())) {
    return <MetaText className={className}>{String(value)}</MetaText>;
  }

  return (
    <time dateTime={date.toISOString()} className={cn("text-sm text-muted-foreground", className)}>
      {date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
    </time>
  );
}
