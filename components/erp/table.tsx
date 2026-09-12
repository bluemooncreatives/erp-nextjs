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
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from 'lucide-react';
import { Badge } from '@/components/erp/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from './page';
import { LinkButton } from '@/components/common/link-button';
import { cn } from '@/components/ui/utils';

export type TableColumn = {
  label: ReactNode;
  className?: string;
  /**
   * Makes the header a sort link writing `?sort=<key>`. The listing's own
   * query is what actually orders the rows - this only puts the key in the
   * URL and draws the current direction.
   */
  sortKey?: string;
  /** Header alignment. Cells keep whatever the page gives their `Td`. */
  align?: 'left' | 'center' | 'right';
};

export type TableSort = {
  /** Current `sort` parameter. */
  key?: string;
  /** Current `dir` parameter. Defaults to ascending. */
  dir?: string;
  /** The listing's own path, for building the header links. */
  baseUrl: string;
  /** Every other current parameter, so sorting keeps the filters. */
  params?: Record<string, string | number | undefined>;
  /** Parameter names to write. Defaults to `sort` and `dir`. */
  sortParam?: string;
  dirParam?: string;
};

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function DataTable({
  columns,
  children,
  isEmpty = false,
  empty = 'No records found.',
  sort,
}: {
  columns: TableColumn[];
  children: ReactNode;
  isEmpty?: boolean;
  empty?: string;
  /** Enables the sort links on any column carrying a `sortKey`. */
  sort?: TableSort;
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
            {columns.map((column, index) => {
              const align = ALIGN_CLASS[column.align ?? 'left'];
              const sortable = Boolean(sort && column.sortKey);
              const isSorted = sortable && sort!.key === column.sortKey;
              const direction = isSorted ? (sort!.dir === 'desc' ? 'desc' : 'asc') : null;

              return (
                <th
                  scope="col"
                  key={index}
                  aria-sort={
                    sortable
                      ? direction === 'asc'
                        ? 'ascending'
                        : direction === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                  className={cn(align, column.className)}
                >
                  {sortable ? (
                    <Link
                      href={sortHref(sort!, column.sortKey!, direction)}
                      scroll={false}
                      className={cn(
                        'hover:text-foreground focus-visible:ring-primary inline-flex items-center gap-1.5 rounded-sm focus:outline-none focus-visible:ring-2',
                        isSorted && 'text-foreground',
                      )}
                    >
                      {column.label}
                      {direction === 'asc' ? (
                        <ArrowUp className="size-3.5 shrink-0" aria-hidden="true" />
                      ) : direction === 'desc' ? (
                        <ArrowDown className="size-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
                      )}
                    </Link>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
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

/**
 * Next URL for a sort header. Cycles ascending -> descending -> unsorted, so a
 * reader can always get back to the listing's own default order.
 */
function sortHref(sort: TableSort, key: string, direction: 'asc' | 'desc' | null): string {
  const sortParam = sort.sortParam ?? 'sort';
  const dirParam = sort.dirParam ?? 'dir';

  const next =
    direction === null ? { key, dir: 'asc' } : direction === 'asc' ? { key, dir: 'desc' } : null;

  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(sort.params ?? {})) {
    // Paging resets: row 40 of one ordering is a different row in another.
    if (name === sortParam || name === dirParam || name === 'page') continue;
    if (value != null && value !== '') search.set(name, String(value));
  }
  if (next) {
    search.set(sortParam, next.key);
    // Ascending is the default, so it stays out of the URL.
    if (next.dir === 'desc') search.set(dirParam, 'desc');
  }

  const query = search.toString();
  return query ? `${sort.baseUrl}?${query}` : sort.baseUrl;
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

/** Page numbers around the current one, with gaps collapsed to ellipses.
 *  Ported from the design system's `DataPagination` - the previous window only
 *  ever showed three consecutive pages, so page 1 and the last page dropped out
 *  of reach entirely on a long list. */
function pageWindow(current: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < totalPages) pages.add(current + 1);

  const ordered = [...pages].sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  let previous = 0;
  for (const value of ordered) {
    if (previous && value - previous > 1) result.push('gap');
    result.push(value);
    previous = value;
  }
  return result;
}

const PAGE_SIZES = [5, 10, 25, 50, 100];

/**
 * Link-based pagination - replaces `{{ $items->links() }}`.
 * Keeps every other query parameter so filters survive paging.
 *
 * Same shape as the design system's `DataPagination`: the count reads
 * "Showing 1-10 of 48" (or "No results"), the page window collapses gaps to
 * ellipses rather than sliding a fixed three-page strip, and phones get a
 * compact "3 / 12" instead of the number list. Rows-per-page is opt-in
 * (`perPageParam`) since it only works on listings whose query reads the size
 * from the URL.
 */
export function Pagination({
  page,
  perPage,
  total,
  baseUrl,
  params = {},
  perPageParam,
}: {
  page: number;
  perPage: number;
  total: number;
  baseUrl: string;
  params?: Record<string, string | number | undefined>;
  /** Query key the listing reads its page size from. Omit to hide the selector. */
  perPageParam?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const pages = pageWindow(safePage, totalPages);

  /** A URL carrying every current parameter plus the overrides given. */
  const href = (overrides: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value != null && value !== '') search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  };

  // `page=1` is the default, so it is dropped rather than written out.
  const pageHref = (target: number) => href({ page: target > 1 ? target : undefined });

  // A single page of results needs no controls, but the count still is useful.
  const showControls = totalPages > 1;

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {total === 0 ? (
            'No results'
          ) : (
            <>
              Showing <span className="text-foreground font-medium">{from}</span>&#8211;
              <span className="text-foreground font-medium">{to}</span> of{' '}
              <span className="text-foreground font-medium">{total}</span>
            </>
          )}
        </p>

        {perPageParam ? (
          <div className="flex items-center gap-1" role="group" aria-label="Rows per page">
            {PAGE_SIZES.map((size) => (
              <LinkButton
                key={size}
                href={href({ [perPageParam]: size, page: undefined })}
                size="sm"
                variant={size === perPage ? 'default' : 'ghost'}
                aria-current={size === perPage ? 'true' : undefined}
                className="h-8 px-2 tabular-nums"
              >
                {size}
              </LinkButton>
            ))}
            <span className="text-muted-foreground text-xs">/ page</span>
          </div>
        ) : null}
      </div>

      {showControls ? (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <PageLink href={pageHref(safePage - 1)} disabled={safePage <= 1} label="Previous page">
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="max-sm:sr-only">Previous</span>
          </PageLink>

          <ul className="flex items-center gap-1 max-sm:hidden">
            {pages.map((entry, index) =>
              entry === 'gap' ? (
                <li key={`gap-${index}`} aria-hidden="true" className="text-muted-foreground px-1 text-sm">
                  &#8230;
                </li>
              ) : (
                <li key={entry}>
                  <PageLink
                    href={pageHref(entry)}
                    active={entry === safePage}
                    label={`Page ${entry}`}
                    className="h-8 w-8 p-0 tabular-nums"
                  >
                    {entry}
                  </PageLink>
                </li>
              ),
            )}
          </ul>

          <span className="text-muted-foreground text-sm tabular-nums sm:hidden">
            {safePage} / {totalPages}
          </span>

          <PageLink
            href={pageHref(safePage + 1)}
            disabled={safePage >= totalPages}
            label="Next page"
          >
            <span className="max-sm:sr-only">Next</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
  label,
  className,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  if (disabled) {
    return (
      <Button variant="ghost" size="sm" disabled aria-disabled="true" aria-label={label} className={className}>
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
      aria-label={label}
      className={className}
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
