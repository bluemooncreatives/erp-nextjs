"use client";

import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

import { CardOverflowMenu } from "./card-overflow-menu";

/** Two list widgets sharing a shell, differing in the leading mark: `variant="icon"`
 *  (avatar + label + count/rate) vs `variant="ring"` (circular progress + badge).
 *  `CardContent` distributes rows to full height rather than bunching at the top. */

export type BreakdownAccent = 1 | 2 | 3 | 4 | 5;

const ACCENT_CHIP: Record<BreakdownAccent, string> = {
  1: "bg-chart-1/10 text-chart-1",
  2: "bg-chart-2/10 text-chart-2",
  3: "bg-chart-3/10 text-chart-3",
  4: "bg-chart-4/10 text-chart-4",
  5: "bg-chart-5/10 text-chart-5",
};

const ACCENT_STROKE: Record<BreakdownAccent, string> = {
  1: "stroke-chart-1",
  2: "stroke-chart-2",
  3: "stroke-chart-3",
  4: "stroke-chart-4",
  5: "stroke-chart-5",
};

export interface BreakdownRow {
  id: string;
  label: string;
  /** Second line under the label (ring variant), e.g. "24 vehicles". */
  detail?: string;
  /** Leading icon — `variant="icon"`. */
  icon?: ReactNode;
  /** 0–100 — `variant="ring"`. */
  percentage?: number;
  accent?: BreakdownAccent;
  /** Left-hand figure on the right side, muted. */
  value?: string;
  /** Trailing figure; a pill in the ring variant, plain text in the icon one. */
  meta?: string;
}

export interface BreakdownListCardProps {
  title: string;
  caption?: string;
  rows: BreakdownRow[];
  variant?: "icon" | "ring";
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function BreakdownListCard({
  title,
  caption,
  rows,
  variant = "icon",
  loading = false,
  onRefresh,
  className,
}: BreakdownListCardProps) {
  return (
    <Card className={cn("justify-between", className)}>
      <CardHeader className={cn("flex justify-between", caption ? "items-start" : "items-center")}>
        {caption ? (
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{title}</span>
            <span className="text-muted-foreground text-sm">{caption}</span>
          </div>
        ) : (
          <span className="text-lg font-semibold">{title}</span>
        )}

        <CardOverflowMenu onRefresh={onRefresh} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {loading ? (
          // Label/value bars sit inside a span carrying the real line's own
          // text-size class (`text-base`/`text-sm`) — an empty element still
          // takes that class's line-height as a "strut" — instead of a
          // `Skeleton` height guessed to look about right, which measurably
          // didn't match and shifted everything below this card down.
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className={variant === "ring" ? "size-13 rounded-full" : "size-8 rounded-sm"} />
                <span className="text-base font-medium">
                  <Skeleton className="inline-block h-3.5 w-28 align-middle" />
                </span>
              </div>
              <span className="text-sm">
                <Skeleton className="inline-block h-3.5 w-16 align-middle" />
              </span>
            </div>
          ))
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">Nothing to break down yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2">
              {variant === "ring" ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <CircularProgress
                      value={Math.max(0, Math.min(100, Math.round(row.percentage ?? 0)))}
                      size={52}
                      circleStrokeWidth={4}
                      progressStrokeWidth={4}
                      showLabel
                      labelClassName="text-xs"
                      progressBgClassName="text-primary/15"
                      progressClassName={ACCENT_STROKE[row.accent ?? 1]}
                      aria-label={`${row.label}: ${Math.round(row.percentage ?? 0)} percent`}
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-base font-medium">{row.label}</span>
                      {row.detail ? (
                        <span className="text-muted-foreground truncate text-sm">{row.detail}</span>
                      ) : null}
                    </div>
                  </div>
                  {row.meta ? (
                    <Badge className="bg-primary/10 text-primary h-6 rounded-sm px-3 py-1 tabular-nums">
                      {row.meta}
                    </Badge>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <Avatar className="rounded-sm">
                      <AvatarFallback
                        className={cn(
                          "shrink-0 rounded-sm *:size-4",
                          ACCENT_CHIP[row.accent ?? 1],
                        )}
                      >
                        {row.icon}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-base font-medium">{row.label}</span>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 text-sm tabular-nums">
                    {row.value ? (
                      <span className="text-muted-foreground">{row.value}</span>
                    ) : null}
                    {row.meta ? <span>{row.meta}</span> : null}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default BreakdownListCard;
