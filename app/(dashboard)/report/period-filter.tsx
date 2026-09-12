// The accounting-period select the statement reports filtered by
// (`?interval=`), and the date-range pair the cash flow / daily reports used.

import type { SelectOption } from '@/components/erp/fields';

export function PeriodFilter({
  action,
  options,
  value,
}: {
  action: string;
  options: SelectOption[];
  value?: string;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      <select
        name="interval"
        defaultValue={value ?? ''}
        className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        Show
      </button>
    </form>
  );
}

export function DateRangeFilter({
  action,
  from,
  to,
  fromName = 'dateFrom',
  toName = 'dateTo',
  extra,
}: {
  action: string;
  from?: string;
  to?: string;
  fromName?: string;
  toName?: string;
  extra?: Record<string, string | number | undefined>;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      {Object.entries(extra ?? {}).map(([key, value]) =>
        value == null || value === '' ? null : (
          <input key={key} type="hidden" name={key} value={String(value)} />
        ),
      )}
      <input
        type="date"
        name={fromName}
        defaultValue={from ?? ''}
        className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />
      <input
        type="date"
        name={toName}
        defaultValue={to ?? ''}
        className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />
      <button
        type="submit"
        className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        Search
      </button>
    </form>
  );
}

export function SingleDateFilter({
  action,
  date,
  name = 'date',
}: {
  action: string;
  date?: string;
  name?: string;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        name={name}
        defaultValue={date ?? ''}
        className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />
      <button
        type="submit"
        className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        Search
      </button>
    </form>
  );
}
