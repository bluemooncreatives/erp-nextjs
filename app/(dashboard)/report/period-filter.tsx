// The accounting-period select the statement reports filtered by
// (`?interval=`), and the date-range pair the cash flow / daily reports used.

import { FormInput, FormSelect, type SelectOption } from '@/components/erp/fields';
import { Button } from '@/components/ui/button';
import { Phrase } from '@/context/TranslationContext';

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
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      <FormSelect name="interval" label="Accounting period" defaultValue={value ?? ''} options={options} wrapperClassName="min-w-48 flex-1" />
      <Button type="submit" variant="soft">Show</Button>
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
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      {Object.entries(extra ?? {}).map(([key, value]) =>
        value == null || value === '' ? null : (
          <input key={key} type="hidden" name={key} value={String(value)} />
        ),
      )}
      <FormInput
        type="date"
        name={fromName}
        label="From date"
        defaultValue={from ?? ''}
        wrapperClassName="min-w-36 flex-1"
      />
      <FormInput
        type="date"
        name={toName}
        label="To date"
        defaultValue={to ?? ''}
        wrapperClassName="min-w-36 flex-1"
      />
      <Button type="submit" variant="soft"><Phrase>Search</Phrase></Button>
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
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      <FormInput
        type="date"
        name={name}
        label="Date"
        defaultValue={date ?? ''}
        wrapperClassName="min-w-36 flex-1"
      />
      <Button type="submit" variant="soft"><Phrase>Search</Phrase></Button>
    </form>
  );
}
