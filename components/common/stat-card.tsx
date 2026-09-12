import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

/** Summary tile with states inline copies never had (loading, trend, link).
 *  Trend is typed, not a pre-formatted string — old cards coloured "-8.7%"
 *  like a gain. Figure is `text-xl font-semibold`, one step below the page h1. */

export type TrendDirection = "up" | "down" | "flat";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Secondary line under the value — "of 500", "UTC month", etc. */
  detail?: ReactNode;
  icon?: LucideIcon;
  trend?: {
    direction: TrendDirection;
    value: string;
    /** What the comparison is against. Defaults to "vs last period". */
    label?: string;
    /** Set when a rise is bad (error rate, spend) so the colour flips. */
    inverted?: boolean;
  };
  /** Turns the whole tile into a link to the detail behind the number. */
  to?: string;
  loading?: boolean;
  className?: string;
}

const TREND_ICON: Record<TrendDirection, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
};

function trendToneClass(direction: TrendDirection, inverted?: boolean): string {
  if (direction === "flat") return "text-muted-foreground";
  const isGood = inverted ? direction === "down" : direction === "up";
  return isGood ? "text-success" : "text-destructive";
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  to,
  loading = false,
  className,
}: StatCardProps) {
  const showFooter = Boolean(detail) || Boolean(trend);

  const body = (
    <div className="flex items-stretch gap-3">
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>

        {loading ? (
          // Matches the real value box exactly (`mt-1` + `text-xl
          // leading-tight`'s 1.5625rem line-height), not a round Tailwind
          // step — a nearby-but-off skeleton height was measurably shifting
          // every StatCard's footer line and everything below it by 5px the
          // instant real data replaced it (confirmed via the Layout
          // Instability API, not eyeballed).
          <Skeleton className="mt-1 h-[1.5625rem] w-24" />
        ) : (
          <div className="mt-1 text-xl font-semibold leading-tight tabular-nums text-foreground">
            {value}
          </div>
        )}

        {showFooter ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {trend ? (
              loading ? (
                <Skeleton className="h-4 w-12" />
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                    trendToneClass(trend.direction, trend.inverted),
                  )}
                >
                  {(() => {
                    const TrendIcon = TREND_ICON[trend.direction];
                    return <TrendIcon className="size-3.5" aria-hidden="true" />;
                  })()}
                  {trend.value}
                </span>
              )
            ) : null}
            {trend?.label || detail ? (
              <span className="text-xs text-muted-foreground">
                {trend?.label ?? (trend ? "vs last period" : null)}
                {trend?.label && detail ? " · " : null}
                {detail}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/*
        The icon's tinted box is an explicit square (`size-14`), not a
        stretched one: `aspect-square` on a flex item whose height comes from
        `self-stretch` does not resolve - the flex base size is computed from
        content before the stretch, so the box came out tall and narrow. 3.5rem
        is the height of a label + value tile, so it still reads as full-bleed.
      */}
      {Icon ? (
        <span
          className="flex size-14 shrink-0 max-sm:hidden items-center justify-center rounded-lg bg-primary/10 text-primary self-center"
          aria-hidden="true"
        >
          <Icon className="size-6" strokeWidth={1.75} />
        </span>
      ) : null}
    </div>
  );

  const shell =
    "rounded-xl bg-card text-card-foreground shadow-xs ring-1 ring-foreground/10 p-4 transition-colors";

  if (to) {
    return (
      <Link
        href={to}
        className={cn(
          shell,
          "block hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          className,
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={cn(shell, className)}>{body}</div>;
}

/** Responsive tile row — screens pass a count instead of inventing their own `lg:grid-cols-6`. */
export function StatGrid({
  columns = 4,
  children,
  className,
}: {
  columns?: 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
}) {
  const COLUMN_CLASS: Record<number, string> = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-3 lg:grid-cols-5",
    6: "sm:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div className={cn("grid grid-cols-2 gap-3 md:gap-4", COLUMN_CLASS[columns], className)}>
      {children}
    </div>
  );
}
