"use client";

// The spotlight card from the source dashboard's "Top candidates" slot, showing
// what the ERP ranks instead: the customers who bought the most this period.
//
// Structure is unchanged - a leading row for the top entry, a figure row, a
// comparison row with the runners-up as stacked avatars, and a summary line.

import Link from "next/link";
import { ArrowRight, ArrowUp, ChartColumnBig } from "lucide-react";

import { initialsOf } from "@/components/common/cells";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";

import { CardOverflowMenu } from "./card-overflow-menu";

export interface TopCustomer {
  id: number;
  name: string;
  /** What they are ranked by, already summed. */
  total: number;
  /** Second line under the name - their invoice count, say. */
  detail?: string;
}

export interface TopCustomersCardProps {
  className?: string;
  customers: TopCustomer[];
  /** Formats every figure on the card. */
  formatValue: (value: number) => string;
  /** Where "View all" goes. */
  viewAllHref: string;
  /** The closing line - invoice counts across the period. */
  summary?: string;
  title?: string;
}

export function TopCustomersCard({
  className,
  customers,
  formatValue,
  viewAllHref,
  summary,
  title = "Top customers",
}: TopCustomersCardProps) {
  const ranked = [...customers].sort((a, b) => b.total - a.total);
  const top = ranked[0];
  const others = ranked.slice(1, 5);
  const average =
    ranked.length > 0
      ? ranked.reduce((sum, customer) => sum + customer.total, 0) / ranked.length
      : null;
  const delta = top && average !== null ? top.total - average : null;

  return (
    <Card className={cn("flex w-full flex-col justify-between gap-5", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <div className="flex items-center gap-2">
          <ChartColumnBig className="text-primary size-6 shrink-0" aria-hidden="true" />
          <span className="text-foreground text-lg font-semibold tracking-tight">
            {title}
          </span>
        </div>
        <CardOverflowMenu viewAllHref={viewAllHref} viewAllLabel="View customers" />
      </CardHeader>

      {!top ? (
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10 text-center">
          <p className="text-foreground text-sm font-medium">No sales yet</p>
          <p className="text-muted-foreground text-xs">
            Once an invoice is approved, your best customers show up here.
          </p>
        </CardContent>
      ) : (
        <CardContent className="flex flex-col gap-3.5 pt-0">
          {/* Top customer */}
          <div className="border-border/60 bg-muted/40 flex items-center gap-3.5 rounded-xl border px-4 py-2.5">
            <Avatar className="ring-border/40 size-11 shrink-0 ring-1" size="lg">
              <AvatarFallback className="text-sm">{initialsOf(top.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              {top.detail ? (
                <span className="text-muted-foreground text-xs leading-tight">
                  {top.detail}
                </span>
              ) : null}
              <span className="text-foreground truncate text-base font-semibold tracking-tight">
                {top.name}
              </span>
            </div>
          </div>

          {/* Rank + total */}
          <div className="border-border/60 bg-muted/40 flex items-center justify-between rounded-xl border px-4 py-3">
            <Badge className="bg-success/10 text-success">Highest spend</Badge>
            <span className="text-foreground text-xl font-bold tracking-tight tabular-nums">
              {formatValue(top.total)}
            </span>
          </div>

          {/* Against the period average, with the runners-up */}
          <div className="border-border/60 bg-muted/40 flex flex-col gap-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs">Average customer</span>
                <span className="text-foreground text-2xl font-bold tracking-tight tabular-nums">
                  {average === null ? "-" : formatValue(average)}
                </span>
              </div>
              {delta !== null && delta > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="bg-success/15 text-success ring-success/25 flex size-7 shrink-0 items-center justify-center rounded-full ring-1">
                    <ArrowUp className="size-4 stroke-[2.5]" aria-hidden="true" />
                  </span>
                  <span className="text-success text-base font-bold tracking-tight tabular-nums">
                    +{formatValue(delta)}
                  </span>
                </div>
              ) : null}
            </div>

            {others.length > 0 ? (
              <div className="flex items-center justify-between pt-1">
                <AvatarGroup>
                  {others.map((customer) => (
                    <Tooltip key={customer.id}>
                      <TooltipTrigger asChild>
                        <Avatar className="cursor-pointer transition-all duration-200 ease-in-out hover:z-10 hover:-translate-y-1 hover:shadow-md">
                          <AvatarFallback className="text-2xs">
                            {initialsOf(customer.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        {customer.name} · {formatValue(customer.total)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </AvatarGroup>

                <Button variant="soft" size="sm" asChild>
                  <Link href={viewAllHref}>
                    View all
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          {summary ? (
            <p className="text-muted-foreground pt-1 text-center text-xs leading-relaxed">
              {summary}
            </p>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
