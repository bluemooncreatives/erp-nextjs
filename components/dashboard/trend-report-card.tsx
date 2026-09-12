"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import { CardOverflowMenu } from "./card-overflow-menu";
import { formatValue as printValue, type ValueFormat } from "./format";
import { YAxisTick, Y_AXIS_WIDTH } from "./chart-axis";
import { cn } from "@/components/ui/utils";

/** Split trend+report card, two `Card`s with `rounded-none shadow-none ring-0`
 *  so the outer card owns one outline. `baseline` opts into a non-zero
 *  y-axis floor (exaggerates movement) — defaults to 0 for magnitude comparisons. */

export interface TrendPoint {
  label: string;
  value: number;
}

export interface ReportRow {
  id: string;
  label: string;
  value: string;
  icon: ReactNode;
  /** Tints the row icon; cycles the chart tokens as the template does. */
  accent?: 1 | 2 | 3 | 4 | 5;
}

export interface TrendReportCardProps {
  /** Left pane. */
  trendTitle: string;
  trendCaption: string;
  data: TrendPoint[];
  /** Series name shown in the tooltip. */
  seriesLabel: string;
  /** How the y-axis ticks and tooltip figures are printed. */
  format?: ValueFormat;
  /** Y-axis floor: `"zero"` (default) starts at 0; `"data"` starts below the lowest point. */
  baseline?: "zero" | "data";
  /** Y-axis band width in px. Recharts defaults to 60; 44 fits a short tick like "84%" — raise it for longer ticks like "$120k". */
  yAxisWidth?: number;

  /** Right pane. */
  reportTitle: string;
  reportCaption: string;
  rows: ReportRow[];

  loading?: boolean;
  onRefresh?: () => void;
  /** Unique per page; keys the gradient so two instances can't collide. */
  gradientId?: string;
  className?: string;
}

const ACCENT_TEXT: Record<NonNullable<ReportRow["accent"]>, string> = {
  1: "text-chart-1",
  2: "text-chart-2",
  3: "text-chart-3",
  4: "text-chart-4",
  5: "text-chart-5",
};

/** A rounded floor/ceiling for the axis, so ticks land on whole steps instead of the raw data's min/max. */
function niceDomain(values: number[], baseline: "zero" | "data"): [number, number] {
  if (values.length === 0) return [0, 1];

  const max = Math.max(...values);
  const min = Math.min(...values);

  // Step to the nearest power-of-ten-ish increment that gives ~5 bands.
  const rawStep = (max - (baseline === "zero" ? 0 : min)) / 5 || max / 5 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.ceil(rawStep / magnitude) * magnitude;

  const floor = baseline === "zero" ? 0 : Math.max(0, Math.floor(min / step) * step - step);
  const ceiling = Math.ceil(max / step) * step;

  return [floor, ceiling === floor ? floor + step : ceiling];
}

export function TrendReportCard({
  trendTitle,
  trendCaption,
  data,
  seriesLabel,
  format,
  baseline = "zero",
  yAxisWidth = Y_AXIS_WIDTH,
  reportTitle,
  reportCaption,
  rows,
  loading = false,
  onRefresh,
  gradientId = "trend",
  className,
}: TrendReportCardProps) {
  const fillId = `fill-${gradientId}`;
  const formatValue = (value: number) => printValue(value, format);

  const chartConfig = {
    value: { label: seriesLabel, color: "var(--primary)" },
  } satisfies ChartConfig;

  const hasData = data.some((point) => point.value > 0);
  const domain = niceDomain(
    data.map((point) => point.value),
    baseline,
  );

  return (
    <Card className={cn("grid gap-0 py-0 lg:grid-cols-3", className)}>
      <Card className="rounded-none shadow-none ring-0 max-lg:border-b lg:col-span-2 lg:border-r">
        <CardHeader className="flex justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{trendTitle}</span>
            <span className="text-muted-foreground text-sm">{trendCaption}</span>
          </div>
          <CardOverflowMenu onRefresh={onRefresh} />
        </CardHeader>

        <CardContent>
          {loading ? (
            <Skeleton className="aspect-video max-h-80 min-h-48 w-full" />
          ) : hasData ? (
            <ChartContainer
              config={chartConfig}
              className="max-h-80 min-h-48 w-full text-sm uppercase max-[400px]:max-w-73"
            >
              <AreaChart
                data={data}
                // `left: 0` because the y-axis band already supplies the
                // inset. The right margin stops the final x-axis label
                // overhanging the plot and being clipped by the card.
                margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="20%" stopColor="var(--primary)" stopOpacity={1} />
                    <stop offset="80%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3"
                  strokeWidth={2}
                  stroke="var(--border)"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  // Drop labels rather than let them collide when the pane is
                  // narrow, always keeping the first and last so the range
                  // stays readable.
                  interval="preserveStartEnd"
                  minTickGap={16}
                  tick={{ fill: "var(--muted-foreground)" }}
                />

                <YAxis
                  width={yAxisWidth}
                  domain={domain}
                  tickCount={6}
                  tickLine={false}
                  axisLine={false}
                  tick={<YAxisTick format={formatValue} />}
                />

                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent formatter={(value) => formatValue(Number(value))} />
                  }
                />

                <Area
                  dataKey="value"
                  type="linear"
                  strokeWidth={2}
                  stroke="var(--primary)"
                  fill={`url(#${fillId})`}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex aspect-video max-h-80 min-h-48 items-center justify-center text-center">
              <p className="text-muted-foreground text-sm normal-case">
                No history to plot yet.
                <br />
                The trend fills in as data arrives.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col gap-10 rounded-none shadow-none ring-0">
        <CardHeader className="flex justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">{reportTitle}</span>
            <span className="text-muted-foreground text-sm">{reportCaption}</span>
          </div>
          <CardOverflowMenu onRefresh={onRefresh} />
        </CardHeader>

        <CardContent className="grow text-base">
          <div className="flex h-full flex-col gap-4">
            {rows.map((row) => (
              <div
                key={row.id}
                className="bg-muted flex grow items-center justify-between gap-4 rounded-md px-4 py-2"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar size="lg" className="rounded-sm">
                    {/* The icon carries its own colour and stroke weight, as in
                        the template — no wrapper element around it. */}
                    <AvatarFallback
                      className={cn(
                        "bg-card shrink-0 rounded-sm [&_svg]:size-6 [&_svg]:stroke-[1.5]",
                        ACCENT_TEXT[row.accent ?? 1],
                      )}
                    >
                      {row.icon}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-muted-foreground truncate font-medium">
                      {row.label}
                    </span>
                    {loading ? (
                      <Skeleton className="h-6 w-20" />
                    ) : (
                      <span className="truncate text-lg font-medium tabular-nums">
                        {row.value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Card>
  );
}

export default TrendReportCard;
