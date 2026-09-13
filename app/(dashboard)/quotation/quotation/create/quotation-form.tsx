'use client';

import { LinkButton } from '@/components/common/link-button';
// Quotation form - port of `quotation::quotation.create`.
//
// Same cart maths as the sale form; quotations move no stock, so any product
// can be quoted whether or not it is currently in stock.

import { useActionState, useMemo, useState } from 'react';
import { Card } from '@/components/erp/page';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { DataTable, Td, Tr } from '@/components/erp/table';
import { ROUTES } from '@/lib/routes';
import {
  storeQuotation,
  updateQuotationAction,
  type QuotationFormState,
} from '../../actions';
import { Phrase } from '@/context/TranslationContext';

const INITIAL: QuotationFormState = {};

export type QuotableProduct = {
  id: number;
  label: string;
  sellingPrice: number;
  tax: number;
};

type CartLine = {
  key: string;
  productId: number;
  label: string;
  price: number;
  quantity: number;
  tax: number;
  discount: number;
};

/** The quotation being edited, as `quotation::quotation.edit` pre-filled it. */
export type QuotationFormDefaults = {
  /**
   * The quotation being edited. Omitted when the form is seeded from another
   * document - a sale being turned into a quotation - because that posts a new
   * record rather than editing the source.
   */
  id?: number;
  customerId: string;
  locationRef: string;
  date: string;
  validTillDate: string;
  refNo: string;
  shippingAddress: string;
  notes: string;
  discountType: string;
  discountValue: number;
  taxId: string;
  shippingCharge: number;
  otherCharge: number;
  lines: Array<{
    productId: number;
    label: string;
    price: number;
    quantity: number;
    tax: number;
    discount: number;
  }>;
};

export function QuotationForm({
  customers,
  locations,
  taxes,
  products,
  currencySymbol,
  defaultLocation,
  defaults,
  submitLabel,
}: {
  customers: SelectOption[];
  locations: SelectOption[];
  taxes: Array<{ id: number; name: string; rate: number }>;
  products: QuotableProduct[];
  currencySymbol: string;
  defaultLocation?: string;
  defaults?: QuotationFormDefaults;
  submitLabel?: string;
}) {
  // Seeded-but-new forms (a sale converted to a quotation) carry defaults with
  // no id, and must store rather than update.
  const [state, formAction] = useActionState(
    defaults?.id ? updateQuotationAction : storeQuotation,
    INITIAL,
  );

  const [lines, setLines] = useState<CartLine[]>(
    defaults?.lines.map((l) => ({
      key: `p-${l.productId}`,
      productId: l.productId,
      label: l.label,
      price: l.price,
      quantity: l.quantity,
      tax: l.tax,
      discount: l.discount,
    })) ?? [],
  );
  // Which button submitted - the Blade's "save", "save and mail" and
  // "save and preview" set these hidden fields.
  const [sendMail, setSendMail] = useState(false);
  const [preview, setPreview] = useState(false);
  const [discountType, setDiscountType] = useState(defaults?.discountType ?? '1');
  const [discountValue, setDiscountValue] = useState(defaults?.discountValue ?? 0);
  const [taxId, setTaxId] = useState(defaults?.taxId ?? '0');
  const [shipping, setShipping] = useState(defaults?.shippingCharge ?? 0);
  const [other, setOther] = useState(defaults?.otherCharge ?? 0);

  const addLine = (value: string) => {
    const product = products.find((p) => String(p.id) === value);
    if (!product) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key: `p-${product.id}`,
          productId: product.id,
          label: product.label,
          price: product.sellingPrice,
          quantity: 1,
          tax: product.tax,
          discount: 0,
        },
      ];
    });
  };

  const patch = (key: string, value: Partial<CartLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...value } : l)));

  const totals = useMemo(() => {
    let itemAmount = 0;
    let totalQuantity = 0;
    for (const line of lines) {
      const lineTotal = line.price * line.quantity;
      itemAmount +=
        lineTotal + (lineTotal * line.tax) / 100 - (lineTotal * line.discount) / 100;
      totalQuantity += line.quantity;
    }

    const invoiceDiscount =
      discountType === '2' ? (itemAmount * discountValue) / 100 : discountValue;
    const selectedTax = taxes.find((t) => String(t.id) === taxId);
    const invoiceTax = selectedTax
      ? ((itemAmount - invoiceDiscount) * selectedTax.rate) / 100
      : 0;

    return {
      itemAmount,
      totalQuantity,
      invoiceDiscount,
      invoiceTax,
      taxRate: selectedTax?.rate ?? 0,
      payable: itemAmount - invoiceDiscount + invoiceTax + shipping + other,
    };
  }, [lines, discountType, discountValue, taxId, shipping, other, taxes]);

  const money = (v: number) => `${currencySymbol} ${v.toFixed(2)}`;

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert variant="error" message={state.error} />

      <input type="hidden" name="item_amount" value={totals.itemAmount.toFixed(2)} />
      <input type="hidden" name="total_quantity" value={totals.totalQuantity} />
      <input
        type="hidden"
        name="total_tax"
        value={`${totals.invoiceTax.toFixed(2)}-${taxId}`}
      />
      <input
        type="hidden"
        name="total_discount_amount"
        value={totals.invoiceDiscount.toFixed(2)}
      />
      <input type="hidden" name="total_discount" value={discountValue} />
      <input type="hidden" name="total_amount" value={totals.payable.toFixed(2)} />

      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <Card title="Quotation">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="Customer"
            name="customer_id"
            required
            placeholder="Select customer"
            defaultValue={defaults?.customerId ?? ''}
            options={customers}
            error={state.fieldErrors?.customer_id}
          />
          <FormSelect
            label="Branch / Warehouse"
            name="showroom"
            placeholder="Select location"
            defaultValue={defaults?.locationRef ?? defaultLocation ?? ''}
            options={locations}
          />
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
            error={state.fieldErrors?.date}
          />
          <FormInput
            label="Valid Until"
            name="valid_till_date"
            type="date"
            required
            defaultValue={defaults?.validTillDate ?? ''}
            error={state.fieldErrors?.valid_till_date}
          />
          <FormInput label="Reference No" name="ref_no" defaultValue={defaults?.refNo ?? ''} />
          <FormInput
            label="Shipping Address"
            name="shipping_address"
            defaultValue={defaults?.shippingAddress ?? ''}
          />
          <FormInput label="Documents" name="documents" type="file" multiple />
        </div>
      </Card>

      <Card title="Products">
        <div className="mb-4 max-w-md">
          <FormSelect
            label="Add product"
            name="_picker"
            value=""
            onChange={(e) => addLine(e.target.value)}
            placeholder="Search and select a product"
            options={products.map((p) => ({
              value: p.id,
              label: `${p.label} - ${money(p.sellingPrice)}`,
            }))}
          />
        </div>

        {state.fieldErrors?.items ? (
          <p className="mb-3 text-xs text-destructive">{state.fieldErrors.items}</p>
        ) : null}

        <DataTable
          columns={[
            { label: 'Product' },
            { label: 'Price' },
            { label: 'Qty' },
            { label: 'Tax %' },
            { label: 'Disc %' },
            { label: 'Subtotal' },
            { label: '' },
          ]}
          isEmpty={lines.length === 0}
          empty="No products added yet."
        >
          {lines.map((line) => {
            const lineTotal = line.price * line.quantity;
            const subTotal =
              lineTotal + (lineTotal * line.tax) / 100 - (lineTotal * line.discount) / 100;
            return (
              <Tr key={line.key}>
                <Td className="font-medium text-foreground">
                  {line.label}
                  <input type="hidden" name="items" value={line.productId} />
                </Td>
                <Td>
                  <NumberCell
                    name="item_price"
                    value={line.price}
                    onChange={(v) => patch(line.key, { price: v })}
                  />
                </Td>
                <Td>
                  <NumberCell
                    name="item_quantity"
                    value={line.quantity}
                    min={1}
                    step="1"
                    onChange={(v) => patch(line.key, { quantity: v })}
                  />
                </Td>
                <Td>
                  <NumberCell
                    name="product_tax"
                    value={line.tax}
                    onChange={(v) => patch(line.key, { tax: v })}
                  />
                </Td>
                <Td>
                  <NumberCell
                    name="item_discount"
                    value={line.discount}
                    onChange={(v) => patch(line.key, { discount: v })}
                  />
                </Td>
                <Td className="font-medium">{money(subTotal)}</Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Phrase>Remove</Phrase>
                  </button>
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Charges & Discount">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormSelect
              label="Discount Type"
              name="discount_type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
              options={[
                { value: '1', label: 'Fixed' },
                { value: '2', label: 'Percentage' },
              ]}
            />
            <FormInput
              label={discountType === '2' ? 'Discount (%)':'Discount amount'}
              name="_discount_value"
              type="number"
              step="0.01"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
            />
            <FormSelect
              label="Tax"
              name="_tax_id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              options={[
                { value: '0', label: 'No tax' },
                ...taxes.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` })),
              ]}
            />
            <FormInput
              label="Shipping Charge"
              name="shipping_charge"
              type="number"
              step="0.01"
              min="0"
              value={shipping}
              onChange={(e) => setShipping(Number(e.target.value))}
            />
            <FormInput
              label="Other Charge"
              name="other_charge"
              type="number"
              step="0.01"
              min="0"
              value={other}
              onChange={(e) => setOther(Number(e.target.value))}
            />
          </div>
          <FormTextarea
            label="Notes"
            name="notes"
            wrapperClassName="mt-5"
            defaultValue={defaults?.notes ?? ''}
          />
        </Card>

        <Card title="Summary">
          <dl className="space-y-3 text-sm">
            <Row label="Items total" value={money(totals.itemAmount)} />
            <Row label="Discount" value={`- ${money(totals.invoiceDiscount)}`} />
            <Row label={`Tax (${totals.taxRate}%)`} value={money(totals.invoiceTax)} />
            <Row label="Shipping" value={money(shipping)} />
            <Row label="Other charges" value={money(other)} />
            <div className="border-t border-border pt-3">
              <Row label="Payable" value={money(totals.payable)} strong />
            </div>
          </dl>
        </Card>
      </div>

      <input type="hidden" name="send_mail" value={sendMail ? '1' : ''} />
      <input type="hidden" name="preview_status" value={preview ? '1' : ''} />

      <div className="flex items-center justify-end gap-3">
        <LinkButton
          href={ROUTES['quotation.index']}
          variant="outline"
        >
          <Phrase>Cancel</Phrase>
        </LinkButton>
        <button
          type="submit"
          disabled={lines.length === 0}
          onClick={() => {
            setSendMail(false);
            setPreview(true);
          }}
          className="rounded-lg px-5 py-3 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted disabled:opacity-50"
        >
          Save &amp; Preview
        </button>
        <button
          type="submit"
          disabled={lines.length === 0}
          onClick={() => {
            setPreview(false);
            setSendMail(true);
          }}
          className="rounded-lg px-5 py-3 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted disabled:opacity-50"
        >
          Save &amp; Send Mail
        </button>
        <SubmitButton
          disabled={lines.length === 0}
          onClick={() => {
            setSendMail(false);
            setPreview(false);
          }}
        >
          {submitLabel ?? 'Save Quotation'}
        </SubmitButton>
      </div>
    </form>
  );
}

function NumberCell({
  name,
  value,
  onChange,
  min = 0,
  step = '0.01',
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: string;
}) {
  return (
    <input
      type="number"
      name={name}
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 w-24 rounded-lg border border-border bg-transparent px-2 text-sm"
    />
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          strong
            ? 'text-base font-semibold text-foreground '
            : 'text-foreground '
        }
      >
        {value}
      </dd>
    </div>
  );
}
