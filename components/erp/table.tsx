// ---------------------------------------------------------------------------
// Listing table + server-rendered pagination and search.
//
// The PHP screens used DataTables over a fully-rendered table. These keep the
// same server-rendered model - paging and searching are URL parameters, so a
// listing works without client JavaScript, as the Blade version effectively did
// for its first paint.
//
// Presentation comes from the design system: `.table-unified` for the table
// chrome, the Button/Input primitives for the controls, and semantic tokens
// throughout, so a listing matches every other surface in the product.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import React, { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/erp/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/utils';

export function DataTable({
  columns,
  children,
  isEmpty = false,
  empty = 'No records found.',
}: {
  columns: Array<{ label: ReactNode; className?: string }>;
  children: ReactNode;
  isEmpty?: boolean;
  empty?: string;
}) {
  return (
    <div className="minimal-scrollbar max-w-full overflow-x-auto">
      <table className="table-unified w-full">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} className={cn('text-left', column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isEmpty ? (
            <tr>
              <td
                colSpan={Math.max(1, columns.length)}
                className="text-muted-foreground py-10 text-center text-sm"
              >
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

/** A body cell. Padding and rules come from `.table-unified`. */
export function Td({
  children,
  className = '',
  colSpan,
}: {
  /** Optional, so an intentionally blank cell can be written `<Td />`. */
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn('text-sm', className)}>
      {children}
    </td>
  );
}

export function Tr({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={className}>{children}</tr>;
}

/** `showStatus($status)` from Helper.php. */
export function StatusBadge({ status }: { status: number | boolean | null }) {
  const active = status === 1 || status === true;
  return (
    <Badge color={active ? 'success' : 'error'} size="sm">
      {active ? 'Active' : 'DeActive'}
    </Badge>
  );
}

/**
 * Link-based pagination - replaces `{{ $items->links() }}`.
 * Keeps every other query parameter so filters survive paging.
 */
export function Pagination({
  page,
  perPage,
  total,
  baseUrl,
  params = {},
}: {
  page: number;
  perPage: number;
  total: number;
  baseUrl: string;
  params?: Record<string, string | number | undefined>;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '' && key !== 'page') {
        search.set(key, String(value));
      }
    }
    if (target > 1) search.set('page', String(target));
    const query = search.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  };

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const start = Math.max(1, Math.min(page - 1, lastPage - 2));
  const pages: number[] = [];
  for (let p = start; p <= Math.min(lastPage, start + 2); p++) pages.push(p);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
    >
      <p className="text-muted-foreground text-sm">
        Showing <span className="text-foreground font-medium">{from}</span> to{' '}
        <span className="text-foreground font-medium">{to}</span> of{' '}
        <span className="text-foreground font-medium">{total}</span> entries
      </p>

      <div className="flex items-center gap-1">
        <PageLink href={href(page - 1)} disabled={page <= 1}>
          <ChevronLeft />
          <span className="hidden sm:inline">Previous</span>
        </PageLink>

        {start > 1 ? <Ellipsis /> : null}
        {pages.map((target) => (
          <PageLink key={target} href={href(target)} active={target === page}>
            {target}
          </PageLink>
        ))}
        {start + 2 < lastPage ? <Ellipsis /> : null}

        <PageLink href={href(page + 1)} disabled={page >= lastPage}>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight />
        </PageLink>
      </div>
    </nav>
  );
}

function Ellipsis() {
  return (
    <span aria-hidden="true" className="text-muted-foreground px-1.5 text-sm">
      …
    </span>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <Button variant="ghost" size="sm" disabled aria-disabled="true">
        {children}
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="sm"
      variant={active ? 'default' : 'ghost'}
      aria-current={active ? 'page' : undefined}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

/**
 * Search box that submits as a GET form, so the term lands in the URL and the
 * server does the filtering - the same model the PHP `search_index` routes used.
 */
export function SearchBar({
  action,
  name = 'search',
  defaultValue = '',
  placeholder = 'Search...',
  hidden = {},
  children,
}: {
  action: string;
  /** The query key this form posts - the PHP used `search` or `search_keyword`. */
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  hidden?: Record<string, string | number | undefined>;
  children?: ReactNode;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      {Object.entries(hidden).map(([key, value]) =>
        value == null || value === '' ? null : (
          <input key={key} type="hidden" name={key} value={String(value)} />
        ),
      )}
      <Input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full sm:w-64"
      />
      {children}
      <Button type="submit">Search</Button>
    </form>
  );
}
