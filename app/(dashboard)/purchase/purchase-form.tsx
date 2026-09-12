'use client';

// Purchase order entry - port of `purchase::purchase_order.create`.
//
// Same cart model as the sale form, with the purchase-specific fields
// (LC number, CNF agent, supplier, per-line selling price to apply on approval).

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
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
import type { PurchaseFormState } from './actions';

const INITIAL: PurchaseFormState = {};

export type PurchasableProduct = {
  id: number;
  label: string;
  purchasePrice: number;
  sellingPrice: number;
  tax: number;
};

export type PurchaseFormOptions = {
  suppliers: SelectOption[];
  locations: SelectOption[];
  taxes: Array<{ id: number; name: string; rate: number }>;
  paymentAccounts: SelectOption[];
  cnfAgents: SelectOption[];
  products: PurchasableProduct[];
};

type CartLine = {
  key: string;
  productId: number;
  label: string;
  price: number;
  sellingPrice: number;
  quantity: number;
  tax: number;
  discount: number;
};

/** The order being edited, as `purchase::purchase.edit` pre-filled its form. */
export type PurchaseFormDefaults = {
  /** Absent when the form is prefilled for a NEW order (the stock alert list). */
  id?: number;
  supplierId: string;
  locationRef: string;
  date: string;
  refNo: string;
  lcNo: string;
  cnfId: string;
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
    sellingPrice: number;
    quantity: number;
    tax: number;
    discount: number;
  }>;
};

export function PurchaseForm({
  options,
  action,
  currencySymbol,
  defaultLocation,
  defaults,
  submitLabel,
}: {
  options: PurchaseFormOptions;
  action: (
    prev: PurchaseFormState,
    formData: FormData,
  ) => Promise<PurchaseFormState>;
  currencySymbol: string;
  defaultLocation?: string;
  defaults?: PurchaseFormDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  const [lines, setLines] = useState<CartLine[]>(
    defaults?.lines.map((l) => ({
      key: `p-${l.productId}`,
      productId: l.productId,
      label: l.label,
      price: l.price,
      sellingPrice: l.sellingPrice,
      quantity: l.quantity,
      tax: l.tax,
      discount: l.discount,
    })) ?? [],
  );
  const [discountType, setDiscountType] = useState(defaults?.discountType ?? '2');
  const [discountValue, setDiscountValue] = useState(defaults?.discountValue ?? 0);
  const [taxId, setTaxId] = useState(defaults?.taxId ?? '0');
  const [shipping, setShipping] = useState(defaults?.shippingCharge ?? 0);
  const [other, setOther] = useState(defaults?.otherCharge ?? 0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);

  const addLine = (value: string) => {
    const product = options.products.find((p) => String(p.id) === value);
    if (!product) return;

    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: `p-${product.id}`,
          productId: product.id,
          label: product.label,
          price: product.purchasePrice,
          sellingPrice: product.sellingPrice,
          quantity: 1,
          tax: product.tax,
          discount: 0,
        },
      ];
    });
  };

  const patchLine = (key: string, patch: Partial<CartLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    let itemAmount = 0;
    let totalQuantity = 0;

    for (const line of lines) {
      itemAmount += line.price * line.quantity;
      totalQuantity += line.quantity;
    }

    // Purchase discount defaults to a percentage (`discount_type` 2).
    const invoiceDiscount =
      discountType === '2' ? (itemAmount * discountValue) / 100 : discountValue;

    const selectedTax = options.taxes.find((t) => String(t.id) === taxId);
    const taxRate = selectedTax?.rate ?? 0;
    const invoiceTax = ((itemAmount - invoiceDiscount) * taxRate) / 100;

    const payable = itemAmount - invoiceDiscount + invoiceTax + shipping + other;

    return { itemAmount, totalQuantity, invoiceDiscount, invoiceTax, taxRate, payable };
  }, [lines, discountType, discountValue, taxId, shipping, other, options.taxes]);

  const money = (value: number) => `${currencySymbol} ${value.toFixed(2)}`;

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert variant="error" message={state.error} />

      <input type="hidden" name="item_amount" value={totals.itemAmount.toFixed(2)} />
      <input type="hidden" name="total_quantity" value={totals.totalQuantity} />
      {/* The PHP stored the tax RATE in `total_vat` and the id after the dash. */}
      <input type="hidden" name="total_tax" value={`${totals.taxRate}-${taxId}`} />
      <input
        type="hidden"
        name="total_discount_amount"
        value={totals.invoiceDiscount.toFixed(2)}
      />
      <input type="hidden" name="total_discount" value={discountValue} />
      <input type="hidden" name="total_amount" value={totals.payable.toFixed(2)} />

      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <Card title="Purchase Order">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="Supplier"
            name="supplier_id"
            required
            placeholder="Select supplier"
            defaultValue={defaults?.supplierId ?? ''}
            options={options.suppliers}
            error={state.fieldErrors?.supplier_id}
          />
          <FormSelect
            label="Branch / Warehouse"
            name="showroom"
            required
            placeholder="Select location"
            defaultValue={defaults?.locationRef ?? defaultLocation ?? ''}
            options={options.locations}
            error={state.fieldErrors?.showroom}
          />
          <FormInput
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={defaults?.date ?? new Date().toISOString().slice(0, 10)}
            error={state.fieldErrors?.date}
          />
          <FormInput label="Reference No" name="ref_no" defaultValue={defaults?.refNo ?? ''} />
          <FormInput label="LC No" name="lc_no" defaultValue={defaults?.lcNo ?? ''} />
          <FormSelect
            label="CNF Agent"
            name="cnf_agent"
            placeholder="Select agent"
            defaultValue={defaults?.cnfId ?? ''}
            options={options.cnfAgents}
          />
          <FormInput
            label="Shipping Address"
            name="shipping_address"
            defaultValue={defaults?.shippingAddress ?? ''}
          />
          <FormInput
            label="Documents"
            name="documents"
            type="file"
            multiple
          />
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
            options={options.products.map((p) => ({
              value: p.id,
              label: `${p.label} - ${money(p.purchasePrice)}`,
            }))}
          />
        </div>

        {state.fieldErrors?.product_id ? (
          <p className="mb-3 text-xs text-error-500">{state.fieldErrors.product_id}</p>
        ) : null}

        <DataTable
          columns={[
            { label: 'Product' },
            { label: 'Purchase Price' },
            { label: 'New Selling Price' },
            { label: 'Qty' },
            { label: 'Tax %' },
            { label: 'Disc' },
            { label: 'Subtotal' },
            { label: '' },
          ]}
          isEmpty={lines.length === 0}
          empty="No products added yet."
        >
          {lines.map((line) => (
            <Tr key={line.key}>
              <Td className="font-medium text-gray-700 dark:text-gray-300">
                {line.label}
                <input type="hidden" name="product_id" value={line.productId} />
              </Td>
              <Td>
                <NumberCell
                  name="product_price"
                  value={line.price}
                  onChange={(v) => patchLine(line.key, { price: v })}
                />
              </Td>
              <Td>
                <NumberCell
                  name="product_selling_price"
                  value={line.sellingPrice}
                  onChange={(v) => patchLine(line.key, { sellingPrice: v })}
                />
              </Td>
              <Td>
                <NumberCell
                  name="product_quantity"
                  value={line.quantity}
                  min={1}
                  step="1"
                  onChange={(v) => patchLine(line.key, { quantity: v })}
                />
              </Td>
              <Td>
                <NumberCell
                  name="product_tax"
                  value={line.tax}
                  onChange={(v) => patchLine(line.key, { tax: v })}
                />
              </Td>
              <Td>
                <NumberCell
                  name="product_discount"
                  value={line.discount}
                  onChange={(v) => patchLine(line.key, { discount: v })}
                />
              </Td>
              <Td className="font-medium">{money(line.price * line.quantity)}</Td>
              <Td>
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) => prev.filter((l) => l.key !== line.key))
                  }
                  className="rounded-lg px-2 py-1 text-theme-xs font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                >
                  Remove
                </button>
              </Td>
            </Tr>
          ))}
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
                { value: '2', label: 'Percentage' },
                { value: '1', label: 'Amount' },
              ]}
            />
            <FormInput
              label={discountType === '2' ? 'Discount (%)' : 'Discount amount'}
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
                ...options.taxes.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.rate}%)`,
                })),
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
            <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
              <Row label="Payable" value={money(totals.payable)} strong />
            </div>
          </dl>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <FormSelect
              label="Payment Method"
              name="payment_method"
              placeholder="No payment now"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank' },
                { value: 'cheque', label: 'Cheque' },
              ]}
            />
            <FormInput
              label="Payment Amount"
              name="payment_amount"
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
            />
            {paymentMethod && paymentMethod !== 'cash' ? (
              <>
                <FormSelect
                  label="Bank Account"
                  name="account_id"
                  placeholder="Select account"
                  options={options.paymentAccounts}
                />
                <FormInput label="Bank Name" name="bank_name" />
                <FormInput label="Branch" name="branch" />
                <FormInput label="Account No" name="account_no" />
                <FormInput label="Account Owner" name="account_owner" />
              </>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['purchase_order.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton disabled={lines.length === 0}>
          {submitLabel ?? 'Save Purchase Order'}
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
      className="h-9 w-24 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
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
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={
          strong
            ? 'text-base font-semibold text-gray-800 dark:text-white/90'
            : 'text-gray-700 dark:text-gray-300'
        }
      >
        {value}
      </dd>
    </div>
  );
}
