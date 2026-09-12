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

import React, { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Badge } from '@/components/erp/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from './page';
import { LinkButton } from '@/components/common/link-button';
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
  // Retain one set of controls/forms in the DOM while presenting source-style
  // labeled rows on mobile. Summary tables with spanning cells keep scrolling.
  const rowElements = React.Children.toArray(children);
  let responsive = true;
  const labeledRows = rowElements.map((row) => {
    if (!React.isValidElement<{ children?: ReactNode }>(row)) return row;
    const cells = React.Children.toArray(row.props.children);
    if (cells.some((cell) => React.isValidElement<{ colSpan?: number; rowSpan?: number }>(cell) && ((cell.props.colSpan ?? 1) > 1 || (cell.props.rowSpan ?? 1) > 1))) responsive = false;
    return React.cloneElement(row, {}, cells.map((cell, index) => {
      if (!React.isValidElement(cell)) return cell;
      const label = columns[index]?.label;
      return React.cloneElement(cell as React.ReactElement<{ 'data-label'?: string }>, {
        'data-label': typeof label === 'string' ? label : '',
      });
    }));
  });
  return (
    <div className="minimal-scrollbar max-w-full overflow-x-auto">
      <table className={cn("table-unified w-full", responsive && "erp-responsive-table")}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th scope="col" key={index} className={cn('text-left', column.className)}>
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
                className="p-0"
              >
                <EmptyState message={empty} />
              </td>
            </tr>
          ) : (
            labeledRows
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
  ...props
}: {
  /** Optional, so an intentionally blank cell can be written `<Td />`. */
  children?: ReactNode;
  className?: string;
  colSpan?: number;
  'data-label'?: string;
}) {
  return (
    <td {...props} colSpan={colSpan} className={cn('text-sm', className)}>
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
      {active ? 'Active' : 'Inactive'}
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
    <LinkButton
      href={href}
      size="sm"
      variant={active ? 'default' : 'ghost'}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </LinkButton>
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
    <form action={action} method="get" className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
      {Object.entries(hidden).map(([key, value]) =>
        value == null || value === '' ? null : (
          <input key={key} type="hidden" name={key} value={String(value)} />
        ),
      )}
      <label className="min-w-0 flex-1 space-y-2 sm:min-w-64">
        <span className="block text-xs font-medium">Search</span>
        <span className="relative block">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
          <Input type="search" name={name} defaultValue={defaultValue} placeholder={placeholder} className="pl-9" />
        </span>
      </label>
      <Button type="submit" variant="soft">Search</Button>
      {defaultValue ? <LinkButton href={`${action}${Object.entries(hidden).filter(([, v]) => v != null && v !== '').length ? '?' + new URLSearchParams(Object.entries(hidden).filter(([, v]) => v != null && v !== '').map(([k,v]) => [k,String(v)])) : ''}`} variant="ghost" aria-label="Clear search"><X className="size-4" />Clear</LinkButton> : null}
      {children}
    </form>
  );
}
