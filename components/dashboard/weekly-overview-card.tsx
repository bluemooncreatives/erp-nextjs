"use client";

import Link from "next/link";
import { Bar, CartesianGrid, Line, YAxis, ComposedChart } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

import { CardOverflowMenu } from "./card-overflow-menu";
import { formatValue as printValue, type ValueFormat } from "./format";

export interface WeeklyOverviewPoint {
  day: string;
  /** The bar series. */
  invited: number;
  /** The line series drawn over it. */
  completed: number;
}

export interface WeeklyOverviewCardProps {
  /** Weekly invited/completed counts — required, not defaulted; a missing prop used to silently fall back to placeholder e-commerce numbers. */
  data: WeeklyOverviewPoint[];
  performancePercent?: number;
  performanceCaption?: string;
  loading?: boolean;
  onRefresh?: () => void;
  /** Where "Details" goes - a link, so a server component can render this. */
  detailsHref?: string;
  /** Card heading and the two series' names, so this reads for any pair. */
  title?: string;
  barLabel?: string;
  lineLabel?: string;
  /** How the y-axis ticks and tooltip figures are printed. */
  format?: ValueFormat;
  className?: string;
}

function buildConfig(barLabel: string, lineLabel: string) {
  return {
    invited: { label: barLabel, color: "var(--primary)" },
    completed: { label: lineLabel, color: "var(--primary)" },
  } satisfies ChartConfig;
}

function formatYAxis(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

export function WeeklyOverviewCard({
  data,
  performancePercent = 0,
  performanceCaption,
  loading = false,
  onRefresh,
  detailsHref,
  title = "Weekly overview",
  barLabel = "Invited",
  lineLabel = "Completed",
  format,
  className,
}: WeeklyOverviewCardProps) {
  const chartConfig = buildConfig(barLabel, lineLabel);
  const formatTick = format
    ? (value: number) => printValue(value, { ...format, compact: true })
    : formatYAxis;
  return (
    <Card className={cn("flex flex-col gap-6", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <span className="text-lg font-semibold">{title}</span>
        <CardOverflowMenu onRefresh={onRefresh} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-6 pt-0">
        {loading ? (
          <Skeleton className="min-h-40 w-full flex-1" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto flex-1 w-full min-h-40">
            <ComposedChart data={data} barCategoryGap="10%" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="4"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTick}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                width={44}
              />
              <Bar
                dataKey="invited"
                fill="color-mix(in oklab, var(--primary) 20%, var(--background))"
                radius={[10, 10, 10, 10]}
                barSize={20}
              />
              <Line
                type="linear"
                dataKey="completed"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ r: 3, fill: "white", stroke: "var(--primary)", strokeWidth: 3 }}
                activeDot={{ r: 5 }}
              />
              <ChartTooltip
                cursor={{ fill: "color-mix(in oklab, var(--primary) 30%, var(--background))" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={() => ""}
                    formatter={(value, name) => (
                      <div className="flex items-center gap-2 font-semibold">
                        <span>{name === "invited" ? barLabel : lineLabel}</span>
                        <span>
                          {format
                            ? printValue(Number(value), format)
                            : Number(value).toLocaleString()}
                        </span>
                      </div>
                    )}
                  />
                }
              />
            </ComposedChart>
          </ChartContainer>
        )}

        <div className="flex flex-col items-stretch gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-medium">{performancePercent}%</span>
            <span className="text-muted-foreground text-sm">{performanceCaption}</span>
          </div>
          {detailsHref ? (
            <Button className="w-full" asChild>
              <Link href={detailsHref}>Details</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>

    </Card>
  );
}
