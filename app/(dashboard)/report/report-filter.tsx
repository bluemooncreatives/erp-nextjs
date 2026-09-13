import { FormInput, FormSelect } from '@/components/erp/fields';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/common/link-button';
import { Filter, X } from 'lucide-react';
import { Phrase } from '@/context/TranslationContext';

export type FilterOption = { value: number | string; label: string };

/** "All branches and warehouses" -> "Branches and warehouses". */
function fieldLabel(allOptionText: string): string {
  const withoutAll = allOptionText.replace(/^all\s+/i, '');
  return withoutAll.charAt(0).toUpperCase() + withoutAll.slice(1);
}

export function ReportFilter({ action, from, to, selects = [] }: {
  action: string; from?: string; to?: string;
  selects?: Array<{ name: string; placeholder: string; value?: string; options: FilterOption[] }>;
}) {
  const filtered = Boolean(from || to || selects.some((select) => select.value));
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      {selects.map((select) => (
        <FormSelect
          key={select.name}
          name={select.name}
          // Callers pass the unfiltered option's own wording ("All customers"),
          // which is what the empty option shows; the field's label is that
          // text without its leading "All", so the two do not read as
          // "All customers: All all customers".
          label={fieldLabel(select.placeholder)}
          defaultValue={select.value ?? ''}
          placeholder={select.placeholder}
          options={select.options}
          wrapperClassName="min-w-40 flex-1"
        />
      ))}
      <FormInput type="date" name="from" label="From date" defaultValue={from ?? ''} wrapperClassName="min-w-36 flex-1" />
      <FormInput type="date" name="to" label="To date" defaultValue={to ?? ''} wrapperClassName="min-w-36 flex-1" />
      <Button type="submit" variant="soft"><Filter /><Phrase>Apply filters</Phrase></Button>
      {filtered ? <LinkButton href={action} variant="ghost"><X /><Phrase>Clear</Phrase></LinkButton> : null}
    </form>
  );
}
