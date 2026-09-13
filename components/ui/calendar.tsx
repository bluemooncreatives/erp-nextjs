"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";

/**
 * Calendar — the design system's DayPicker wrapper.
 *
 * Written against react-day-picker v9 rather than the v8 the source project
 * pinned: v8 requires date-fns 2 or 3, and this app is on date-fns 4. v9
 * renames the class-name slots (`nav_button_previous` became `button_previous`,
 * `head_cell` became `weekday`, and the per-day modifier slots moved under
 * `modifiers`) and replaces the `IconLeft`/`IconRight` components with a single
 * `Chevron`. The rendered result is the same calendar.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(
          "absolute left-1 z-10 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          "border border-border text-foreground hover:bg-accent hover:text-foreground",
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          "absolute right-1 z-10 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          "border border-border text-foreground hover:bg-accent hover:text-foreground",
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md",
        ),
        day_button: cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
          "hover:bg-accent hover:text-foreground",
          "size-8 p-0 font-normal aria-selected:opacity-100",
        ),
        range_start: "day-range-start rounded-s-md",
        range_end: "day-range-end rounded-e-md",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", className)} {...rest} />
          ) : (
            <ChevronRight className={cn("size-4", className)} {...rest} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
