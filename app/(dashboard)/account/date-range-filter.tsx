// Date-range (and optional account) filter used by the accounting reports.
// A plain GET form, so the filter lives in the URL as the PHP screens did.

export function DateRangeFilter({
  action,
  from,
  to,
  accounts,
  accountId,
}: {
  action: string;
  from?: string;
  to?: string;
  accounts?: Array<{ value: number; label: string }>;
  accountId?: string;
}) {
  const control =
    'h-10 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground   ';

  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      {accounts ? (
        <select name="account_id" defaultValue={accountId ?? ''} className={control}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      ) : null}

      <input type="date" name="from" defaultValue={from ?? ''} className={control} />
      <input type="date" name="to" defaultValue={to ?? ''} className={control} />

      <button
        type="submit"
        className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary"
      >
        Filter
      </button>
    </form>
  );
}
