"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon, MinusIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

/** Statistics tile, matching admin-main's markup element for element. `accent`
 *  cycles `--chart-1..4` so tiles read as a set. Correction from admin-main:
 *  delta is typed/coloured here, not a neutral pre-formatted string; `inverted` marks metrics where a rise is bad. */

export type TrendDirection = "up" | "down" | "flat";
export type StatAccent = 1 | 2 | 3 | 4 | 5;

const ACCENT_CLASS: Record<StatAccent, string> = {
  1: "bg-chart-1/10 text-chart-1",
  2: "bg-chart-2/10 text-chart-2",
  3: "bg-chart-3/10 text-chart-3",
  4: "bg-chart-4/10 text-chart-4",
  5: "bg-chart-5/10 text-chart-5",
};

export interface StatisticsCardProps {
  icon?: ReactNode;
  /** Tints the icon chip. Defaults to chart-1. */
  accent?: StatAccent;
  value: ReactNode;
  title: string;
  change?: {
    direction: TrendDirection;
    value: string;
    /** What the delta is measured against ("than last month") — falls through to the badge line when no `badge` is given. */
    label?: string;
    /** Set when a rise is the bad outcome, so the colour flips. */
    inverted?: boolean;
  };
  /** The pill under the figure — a period, a qualifier, a count. */
  badge?: ReactNode;
  /** Plain text under the figure when there is no pill. */
  detail?: ReactNode;
  loading?: boolean;
  className?: string;
}

function toneFor(direction: TrendDirection, inverted?: boolean): string {
  if (direction === "flat") return "text-muted-foreground";
  const good = inverted ? direction === "down" : direction === "up";
  return good ? "text-success" : "text-destructive";
}

export function StatisticsCard({
  icon,
  accent = 1,
  value,
  title,
  change,
  badge,
  detail,
  loading = false,
  className,
}: StatisticsCardProps) {
  const ChangeIcon =
    change?.direction === "up"
      ? ChevronUpIcon
      : change?.direction === "down"
        ? ChevronDownIcon
        : MinusIcon;

  return (
    // "sm" density: at `--card-spacing:24px` (the default) a tile holding
    // one figure, one label and one pill was mostly padding — three lines of
    // content in a box built for a card twice as busy. `--spacing(4)` (16px)
    // still reads as a card, not cramped, next to the taller feature card
    // it shares a row with.
    // `gap-3`, overriding `size="sm"`'s own default `--card-spacing` gap:
    // the icon and the figure below it — the two things that establish what
    // this tile is and what its number is — read as unrelated with a full
    // 16px of dead air between them and nothing bridging it.
    <Card size="sm" className={cn("gap-3", className)}>
      <CardHeader className="flex items-center justify-between">
        {icon ? (
          <Avatar className="size-9.5 rounded-sm">
            <AvatarFallback
              className={cn(
                "size-9.5 shrink-0 rounded-sm [&>svg]:size-4.75",
                ACCENT_CLASS[accent],
              )}
            >
              {icon}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span />
        )}

        {change ? (
          loading ? (
            // `text-base` renders at 24px (measured, not assumed) — `h-5`
            // (20px) was 4px short, shifting everything below the card's
            // header the instant real data replaced it.
            <Skeleton className="h-6 w-12" />
          ) : (
            <p
              className={cn(
                "flex items-center gap-1 text-base tabular-nums",
                toneFor(change.direction, change.inverted),
              )}
            >
              {change.value}
              <ChangeIcon className="size-4" aria-hidden="true" />
            </p>
          )
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <div className="flex flex-col gap-1">
          {loading ? (
            // `text-2xl font-bold` renders at 32px (measured) — `h-7` (28px)
            // was 4px short.
            <Skeleton className="h-8 w-20" />
          ) : (
            <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
          )}
          <span className="text-muted-foreground text-sm">{title}</span>
        </div>

        {badge ? (
          <Badge className="bg-primary/10 text-primary">{badge}</Badge>
        ) : detail ? (
          <span className="text-muted-foreground text-sm">{detail}</span>
        ) : change?.label ? (
          <Badge className="bg-primary/10 text-primary">{change.label}</Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default StatisticsCard;
