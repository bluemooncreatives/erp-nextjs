// ---------------------------------------------------------------------------
// Page chrome - the breadcrumb header and card wrappers every ERP screen uses.
//
// Styled with the TailAdmin tokens so ported screens sit inside the template's
// design system, and shaped like the Blade partials they replace
// (`backEnd/partials/*` plus the `main-title` / `white-box` blocks).
// ---------------------------------------------------------------------------

import Link from 'next/link';
import React, { type ReactNode } from 'react';

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
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        {title}
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        {actions}
        <nav>
          <ol className="flex items-center gap-1.5">
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                href="/home"
              >
                Home
                <Chevron />
              </Link>
            </li>
            {breadcrumb.map((crumb) => (
              <li key={crumb.label} className="inline-flex items-center gap-1.5">
                {crumb.href ? (
                  <>
                    <Link
                      href={crumb.href}
                      className="text-sm text-gray-500 dark:text-gray-400"
                    >
                      {crumb.label}
                    </Link>
                    <Chevron />
                  </>
                ) : (
                  <span className="text-sm text-gray-800 dark:text-white/90">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
            {breadcrumb.length === 0 ? (
              <li className="text-sm text-gray-800 dark:text-white/90">{title}</li>
            ) : null}
          </ol>
        </nav>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className="stroke-current"
      width="17"
      height="16"
      viewBox="0 0 17 16"
      fill="none"
    >
      <path
        d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
        stroke=""
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The standard white panel. */
export function Card({
  title,
  desc,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4 sm:p-6',
  noBodyBorder = false,
}: {
  title?: ReactNode;
  desc?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noBodyBorder?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              {title}
            </h3>
            {desc ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{desc}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <div
        className={`${
          title || actions
            ? noBodyBorder
              ? ''
              : 'border-t border-gray-100 dark:border-gray-800'
            : ''
        } ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
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
    <dl className={`grid gap-x-6 gap-y-4 ${grid}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-sm text-gray-800 dark:text-white/90">
            {item.value ?? '-'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
      {message}
    </div>
  );
}
