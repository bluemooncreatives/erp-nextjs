// Shared report filter bar - a GET form, so a filtered report is a URL the
// user can bookmark or share, as the PHP `*_reports.search` routes were.

export type FilterOption = { value: number | string; label: string };

export function ReportFilter({
  action,
  from,
  to,
  selects = [],
}: {
  action: string;
  from?: string;
  to?: string;
  selects?: Array<{
    name: string;
    placeholder: string;
    value?: string;
    options: FilterOption[];
  }>;
}) {
  const control =
    'h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground   ';

  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      {selects.map((select) => (
        <select
          key={select.name}
          name={select.name}
          defaultValue={select.value ?? ''}
          className={control}
        >
          <option value="">{select.placeholder}</option>
          {select.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      <input type="date" name="from" defaultValue={from ?? ''} className={control} />
      <input type="date" name="to" defaultValue={to ?? ''} className={control} />

      <button
        type="submit"
        className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary"
      >
        Search
      </button>
    </form>
  );
}
