// ---------------------------------------------------------------------------
// Page chrome - the breadcrumb header and card wrappers every ERP screen uses.
//
// Shaped like the Blade partials they replace (`backEnd/partials/*` plus the
// `main-title` / `white-box` blocks), drawn with the design system's Card and
// semantic tokens so every screen sits on the same surfaces.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import React, { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Card as UICard,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/components/ui/utils';

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  breadcrumb = [],
  actions,
}: {
  title: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 space-y-2">
      <nav aria-label="Breadcrumb">
        <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
          <li>
            <Link href="/home" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          {breadcrumb.length === 0 ? (
            <li className="flex items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
              <span className="text-foreground" aria-current="page">
                {title}
              </span>
            </li>
          ) : (
            breadcrumb.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                <ChevronRight
                  className="size-3.5 shrink-0 opacity-60"
                  aria-hidden="true"
                />
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="text-foreground"
                    aria-current={index === breadcrumb.length - 1 ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            ))
          )}
        </ol>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <h1 className="min-w-48 flex-1 text-2xl font-bold tracking-tight text-balance">
          {title}
        </h1>
        {actions ? (
          // `min-w-0` so a wide actions cluster wraps instead of squeezing the
          // heading to nothing.
          <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

/** The standard panel. */
export function Card({
  title,
  desc,
  actions,
  children,
  className = '',
  bodyClassName = 'px-4 py-4 sm:px-6',
  noBodyBorder = false,
}: {
  title?: ReactNode;
  desc?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * Replaces the body's padding rather than adding to it - screens whose body
   * is a full-width table pass `''` so the rows meet the card's edges.
   */
  bodyClassName?: string;
  noBodyBorder?: boolean;
}) {
  const hasHeader = Boolean(title || actions);

  return (
    <UICard className={cn('gap-0 py-0', className)}>
      {hasHeader ? (
        <CardHeader
          className={cn(
            'px-4 py-4 sm:px-6',
            noBodyBorder ? '' : 'border-b [.border-b]:pb-4',
          )}
        >
          {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
          {desc ? <CardDescription>{desc}</CardDescription> : null}
          {actions ? (
            <CardAction className="flex flex-wrap gap-2">{actions}</CardAction>
          ) : null}
        </CardHeader>
      ) : null}

      <CardContent className={cn('px-0', bodyClassName)}>{children}</CardContent>
    </UICard>
  );
}

/** Key/value grid used by every "show" screen in the PHP app. */
export function DetailList({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  const grid =
    columns === 1 ? '' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', grid)}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-muted-foreground text-xs font-medium">{item.label}</dt>
          <dd className="mt-0.5 text-sm">{item.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground py-12 text-center text-sm">{message}</div>
  );
}
