"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

import { CardOverflowMenu } from "./card-overflow-menu";

export type VehiclesConditionAccent = 1 | 2 | 3 | 4 | 5;

const ACCENT_STROKE: Record<VehiclesConditionAccent, string> = {
  1: "stroke-chart-1",
  2: "stroke-chart-2",
  3: "stroke-chart-3",
  4: "stroke-chart-4",
  5: "stroke-chart-5",
};

export interface VehiclesConditionRow {
  id: string;
  label: string;
  detail: string;
  percentage: number;
  accent?: VehiclesConditionAccent;
  badge: string;
}

export interface VehiclesConditionCardProps {
  title?: string;
  rows: VehiclesConditionRow[];
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function VehiclesConditionCard({
  title = "Vehicles Condition",
  rows,
  loading = false,
  onRefresh,
  className,
}: VehiclesConditionCardProps) {
  return (
    <Card className={cn("flex flex-col justify-between gap-6", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <span className="text-lg font-semibold">{title}</span>
        <CardOverflowMenu onRefresh={onRefresh} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-13 rounded-full" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-6 w-14 rounded-sm" />
              </div>
            ))
          : rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {/* Circular ring — exact markup from admin-main's template */}
                  <div
                    className="relative flex shrink-0 items-center justify-center stroke-border"
                    style={{ width: 52, height: 52 }}
                  >
                    <svg
                      viewBox="0 0 52 52"
                      className="size-full -rotate-90 overflow-visible"
                    >
                      <circle
                        cx="26"
                        cy="26"
                        r="23.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                        className="text-primary/20"
                      />
                      <circle
                        cx="26"
                        cy="26"
                        r="23.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeDasharray={147.6548547187203}
                        strokeDashoffset={147.6548547187203 * (1 - row.percentage / 100)}
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                          row.accent ? ACCENT_STROKE[row.accent] : "",
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-medium text-xs">
                      {row.percentage}%
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-medium">{row.label}</span>
                    <span className="text-muted-foreground text-sm">{row.detail}</span>
                  </div>
                </div>

                <Badge
                  className="h-6 rounded-sm px-3 py-1 bg-primary/10 text-primary border-none text-xs font-medium"
                >
                  {row.badge}
                </Badge>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
