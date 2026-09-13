"use client";

import type { ReactNode } from "react";

import DashboardFigure from "./dashboard-figure";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

/** The wide tile closing the statistics row — the single number the row is
 *  about, with a bigger figure and the seated-figure illustration absolutely
 *  positioned bottom-right so it can't push the figure around. */

export type HighlightTrendDirection = "up" | "down" | "flat";

export interface HighlightStatCardProps {
  title: string;
  /** The pill under the title - what the number counts. */
  caption?: ReactNode;
  value: ReactNode;
  change?: {
    direction: HighlightTrendDirection;
    value: string;
    /** Set when a rise is the bad outcome, so the colour flips. */
    inverted?: boolean;
  };
  /** Replaces the default seated figure. */
  illustration?: ReactNode;
  loading?: boolean;
  className?: string;
}

function toneFor(direction: HighlightTrendDirection, inverted?: boolean): string {
  if (direction === "flat") return "text-muted-foreground";
  const good = inverted ? direction === "down" : direction === "up";
  return good ? "text-success" : "text-destructive";
}

export function HighlightStatCard({
  title,
  caption,
  value,
  change,
  illustration,
  loading = false,
  className,
}: HighlightStatCardProps) {
  return (
    <Card size="sm" className={cn("relative min-h-44 justify-between", className)}>
      <CardHeader className="relative flex flex-col items-start gap-3">
        <span className="text-base font-medium">{title}</span>
        {caption ? <Badge className="bg-primary/10 text-primary">{caption}</Badge> : null}
      </CardHeader>

      <CardContent className="relative flex items-center gap-2 pe-16">
        {loading ? (
          <>
            <Skeleton className="h-8 w-24" />
            {change ? <Skeleton className="h-5 w-12" /> : null}
          </>
        ) : (
          <>
            <span className="text-2xl font-semibold tabular-nums">{value}</span>
            {change ? (
              <span
                className={cn(
                  "text-sm tabular-nums",
                  toneFor(change.direction, change.inverted),
                )}
              >
                {change.value}
              </span>
            ) : null}
          </>
        )}
      </CardContent>

      <div className="pointer-events-none absolute right-0.5 bottom-0" aria-hidden="true">
        {illustration ?? <DashboardFigure className="h-auto w-16" />}
      </div>
    </Card>
  );
}

export default HighlightStatCard;
