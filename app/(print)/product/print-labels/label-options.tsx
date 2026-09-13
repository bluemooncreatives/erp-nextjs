// The options the product list's "Print Label" modal posted, on the sheet
// itself so they can be adjusted without going back.
//
// It is a plain GET form: the sheet is driven entirely by the query string, so
// changing an option and submitting re-renders it, and the resulting URL is
// shareable and reprintable.

import { ROUTES } from '@/lib/routes';

const PAGE_SIZES = [
  { value: '0', label: 'One per row' },
  { value: '20', label: '20 per sheet' },
  { value: '30', label: '30 per sheet' },
  { value: '32', label: '32 per sheet' },
  { value: '40', label: '40 per sheet' },
  { value: '50', label: '50 per sheet' },
];

export function LabelOptions({
  sku,
  params,
}: {
  sku: { id: number; name: string } | null;
  params: Record<string, string | undefined>;
}) {
  const checkbox = 'size-4 rounded border-border';

  return (
    <form
      action={ROUTES['print.labels']}
      method="get"
      className="flex flex-wrap items-end gap-4 text-sm"
    >
      {sku ? (
        <>
          <input type="hidden" name="id" value={sku.id} />
          <p className="text-muted-foreground">
            Labels for <span className="text-foreground font-medium">{sku.name}</span>
          </p>
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Product SKU id</span>
          <input
            type="number"
            name="id"
            required
            defaultValue={params.id ?? ''}
            className="border-border h-9 w-32 rounded-lg border bg-transparent px-2"
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">No of Labels</span>
        <input
          type="number"
          name="label"
          min="1"
          max="500"
          defaultValue={params.label ?? '1'}
          className="border-border h-9 w-24 rounded-lg border bg-transparent px-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Sheet</span>
        <select
          name="page"
          defaultValue={params.page ?? '0'}
          className="border-border h-9 rounded-lg border bg-transparent px-2"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="name"
          defaultChecked={params.name != null}
          className={checkbox}
        />
        Product name
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="variation"
          defaultChecked={params.variation != null}
          className={checkbox}
        />
        Variant
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="business_name"
          value="business_name"
          defaultChecked={params.business_name != null}
          className={checkbox}
        />
        Company name
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="product_price"
          value="price"
          defaultChecked={params.product_price != null}
          className={checkbox}
        />
        Price
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Tax</span>
        <select
          name="tax"
          defaultValue={params.tax ?? '0'}
          className="border-border h-9 rounded-lg border bg-transparent px-2"
        >
          <option value="1">Inc. Tax</option>
          <option value="0">Ex. Tax</option>
        </select>
      </label>

      <button
        type="submit"
        className="bg-primary h-9 rounded-lg px-4 text-sm font-medium text-white"
      >
        Update
      </button>
    </form>
  );
}
