import { FormInput, FormSelect } from '@/components/erp/fields';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/common/link-button';
import { Filter, X } from 'lucide-react';

export type FilterOption = { value: number | string; label: string };

export function ReportFilter({ action, from, to, selects = [] }: {
  action: string; from?: string; to?: string;
  selects?: Array<{ name: string; placeholder: string; value?: string; options: FilterOption[] }>;
}) {
  const filtered = Boolean(from || to || selects.some((select) => select.value));
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      {selects.map((select) => <FormSelect key={select.name} name={select.name} label={select.placeholder}
        defaultValue={select.value ?? ''} placeholder={`All ${select.placeholder.toLowerCase()}`} options={select.options}
        wrapperClassName="min-w-40 flex-1" />)}
      <FormInput type="date" name="from" label="From date" defaultValue={from ?? ''} wrapperClassName="min-w-36 flex-1" />
      <FormInput type="date" name="to" label="To date" defaultValue={to ?? ''} wrapperClassName="min-w-36 flex-1" />
      <Button type="submit" variant="soft"><Filter />Apply filters</Button>
      {filtered ? <LinkButton href={action} variant="ghost"><X />Clear</LinkButton> : null}
    </form>
  );
}
