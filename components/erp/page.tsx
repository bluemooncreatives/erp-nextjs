// ---------------------------------------------------------------------------
// Page chrome - the breadcrumb header and card wrappers every ERP screen uses.
//
// Shaped like the Blade partials they replace (`backEnd/partials/*` plus the
// `main-title` / `white-box` blocks), drawn with the design system's Card and
// semantic tokens so every screen sits on the same surfaces.
// ---------------------------------------------------------------------------

import React, { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { PageHeader as ProductPageHeader } from '@/components/common/page-header';
import { EmptyState as ProductEmptyState } from '@/components/common/empty-state';
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

export function PageHeader({ title, breadcrumb = [], actions, description, children }: {
  title: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return <ProductPageHeader
    title={title}
    description={description}
    className="mb-6"
    breadcrumbs={[{ label: 'Home', to: '/home' }, ...(breadcrumb.length ? breadcrumb.map((crumb) => ({ label: crumb.label, to: crumb.href })) : [{ label: title }])]}
    actions={actions}
  >{children}</ProductPageHeader>;
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
            'flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6',
            noBodyBorder ? '' : 'border-b [.border-b]:pb-4',
          )}
        >
          <div className="min-w-0 space-y-1">
            {title ? <CardTitle className="text-lg font-semibold">{title}</CardTitle> : null}
            {desc ? <CardDescription>{desc}</CardDescription> : null}
          </div>
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
        <div key={item.label} className="min-w-0 space-y-1 rounded-lg bg-muted/40 p-3">
          <dt className="text-muted-foreground text-xs font-medium">{item.label}</dt>
          <dd className="text-sm font-medium break-words">{item.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ message, description, action }: { message: string; description?: string; action?: ReactNode }) {
  return <ProductEmptyState icon={Inbox} title={message} description={description} action={action} variant="bare" />;
}
