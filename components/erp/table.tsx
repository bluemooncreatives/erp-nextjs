// ---------------------------------------------------------------------------
// Listing table + server-rendered pagination and search.
//
// The PHP screens used DataTables over a fully-rendered table. These keep the
// same server-rendered model - paging and searching are URL parameters, so a
// listing works without client JavaScript, as the Blade version effectively did
// for its first paint.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import React, { type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Badge from '@/components/ui/badge/Badge';

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
    <div className="max-w-full overflow-x-auto custom-scrollbar">
      <Table>
        <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
          <TableRow>
            {columns.map((col, i) => (
              <TableCell
                key={i}
                isHeader
                className={`px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 whitespace-nowrap ${
                  col.className ?? ''
                }`}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
          {isEmpty ? (
            <TableRow>
              <TableCell className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** A body cell with the table's standard padding. */
export function Td({
  children,
  className = '',
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  const content = (
    <TableCell
      className={`px-5 py-4 text-start text-theme-sm text-gray-600 dark:text-gray-300 ${className}`}
    >
      {children}
    </TableCell>
  );
  // `TableCell` does not forward colSpan; fall back to a plain cell when needed.
  if (colSpan) {
    return (
      <td
        colSpan={colSpan}
        className={`px-5 py-4 text-start text-theme-sm text-gray-600 dark:text-gray-300 ${className}`}
      >
        {children}
      </td>
    );
  }
  return content;
}

export function Tr({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <TableRow className={className}>{children}</TableRow>;
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

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '' && k !== 'page') sp.set(k, String(v));
    }
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  };

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const start = Math.max(1, Math.min(page - 1, lastPage - 2));
  const pages: number[] = [];
  for (let p = start; p <= Math.min(lastPage, start + 2); p++) pages.push(p);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/[0.05]">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing <span className="font-medium text-gray-700 dark:text-gray-300">{from}</span>{' '}
        to <span className="font-medium text-gray-700 dark:text-gray-300">{to}</span> of{' '}
        <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span>{' '}
        entries
      </p>

      <div className="flex items-center">
        <PageLink href={href(page - 1)} disabled={page <= 1} edge="prev">
          Previous
        </PageLink>

        <div className="flex items-center gap-2">
          {start > 1 ? <span className="px-2 text-gray-400">...</span> : null}
          {pages.map((p) => (
            <PageLink key={p} href={href(p)} active={p === page}>
              {p}
            </PageLink>
          ))}
          {start + 2 < lastPage ? <span className="px-2 text-gray-400">...</span> : null}
        </div>

        <PageLink href={href(page + 1)} disabled={page >= lastPage} edge="next">
          Next
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
  edge,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  edge?: 'prev' | 'next';
}) {
  const edgeClass =
    edge === 'prev'
      ? 'mr-2.5 px-3.5 py-2.5 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800'
      : edge === 'next'
        ? 'ml-2.5 px-3.5 py-2.5 border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800'
        : 'w-10';

  const base = `flex h-10 items-center justify-center rounded-lg text-sm font-medium ${edgeClass}`;

  if (disabled) {
    return (
      <span className={`${base} text-gray-400 opacity-50 dark:text-gray-600`}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        active
          ? 'bg-brand-500 text-white'
          : 'text-gray-700 hover:bg-blue-500/[0.08] hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-500'
      }`}
    >
      {children}
    </Link>
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
      {Object.entries(hidden).map(([k, v]) =>
        v == null || v === '' ? null : (
          <input key={k} type="hidden" name={k} value={String(v)} />
        ),
      )}
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 sm:w-64"
      />
      {children}
      <button
        type="submit"
        className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
      >
        Search
      </button>
    </form>
  );
}
