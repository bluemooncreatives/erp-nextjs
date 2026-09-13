import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

/** The page-context block every screen opens with — 30-odd pages used to hand-roll their own heading, no two agreeing on spacing. */

export interface Crumb {
  label: ReactNode;
  /** Omit on the current page — the last crumb renders as plain text. */
  to?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Trail above the title. The final entry should have no `to`. */
  breadcrumbs?: Crumb[];
  /** True while `breadcrumbs` isn't resolved yet — reserves the row as a skeleton so it doesn't appear later and push content down. */
  breadcrumbsLoading?: boolean;
  /** Primary and secondary actions, right-aligned on ≥sm. */
  actions?: ReactNode;
  /** Rendered under the description — tabs, status chips, metadata. */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  breadcrumbsLoading = false,
  actions,
  children,
  className,
}: PageHeaderProps) {
  const hasBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);
  return (
    <header className={cn("space-y-3", className)}>
      {hasBreadcrumbs ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs!.map((crumb, index) => {
              const isLast = index === breadcrumbs!.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? (
                    <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  ) : null}
                  {crumb.to && !isLast ? (
                    <Link
                      href={crumb.to}
                      className="rounded-sm hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? "page" : undefined} className="text-foreground">
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : breadcrumbsLoading ? (
        // `h-5` (1.25rem), not just `items-center`: the real row's height
        // comes from `text-sm`'s line-height, which nothing here otherwise
        // establishes — the bars are 14px tall, so an unset row shrink-wraps
        // to 14px and the whole header shifts up ~6px once real 20px-line-
        // height text replaces it.
        <div
          className="flex h-5 items-center gap-1.5"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading</span>
          <Skeleton className="h-3.5 w-20" aria-hidden="true" />
          <ChevronRight className="size-3.5 shrink-0 opacity-60 text-muted-foreground" aria-hidden="true" />
          <Skeleton className="h-3.5 w-16" aria-hidden="true" />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        {/* `min-w-48` rather than `min-w-0`: with `flex-basis:0%` (Tailwind's
            `flex-1`), the title only ever gets whatever space `actions`
            doesn't claim — and since flex-grow/shrink only activates once
            combined content genuinely exceeds the row, an actions cluster
            that merely *fits* (even barely) is never asked to shrink at all,
            leaving title a sliver regardless of how many action buttons a
            page has. A real floor guarantees the heading room and forces
            actions to be the one that shrinks — and, since it wraps, to
            actually wrap — once the two together don't fit. */}
        <div className="min-w-48 flex-1 space-y-1">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          // No `shrink-0`, and `min-w-0` rather than the default
          // `min-width: auto`: a flex item's automatic minimum size is its
          // content's width on a *single* line, even when that content is
          // itself a `flex-wrap` container — the browser doesn't credit it
          // for being able to wrap internally unless told its minimum can go
          // to zero. Without this, a page with several wide actions (a page
          // can carry three or more buttons) forced this cluster to hold its
          // full un-wrapped width regardless of how little room was left,
          // squeezing the title column down to zero instead of wrapping
          // itself — title text and the actions rendered on top of each other.
          <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
            {actions}
          </div>
        ) : null}
      </div>

      {children}
    </header>
  );
}

/** A titled block inside a page — same heading weight and optional trailing action for every grouping. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  headingLevel: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <Heading className="text-base font-semibold text-foreground">{title}</Heading>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
