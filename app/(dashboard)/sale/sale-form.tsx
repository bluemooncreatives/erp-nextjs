'use client';

// ---------------------------------------------------------------------------
// Sale entry form - port of sale::sale.create.
//
// A cart of line items with per-line tax and discount, an invoice-level
// discount/tax/charges block, and an optional initial payment. The running
// totals mirror the Blade view's jQuery arithmetic exactly:
//
//   line tax      = price * qty * tax%   / 100
//   line discount = price * qty * disc%  / 100
//   line subtotal = price * qty + line tax - line discount
//   invoice total = sum(subtotals) - invoice discount + invoice tax
//                   + shipping + other charges
// ---------------------------------------------------------------------------

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
import type { SaleFormState } from './actions';

const INITIAL: SaleFormState = {};

export type SellableProduct = {
  id: number;
  label: string;
  sellingPrice: number;
  minSellingPrice: number;
  tax: number;
  stock: number;
  isCombo?: boolean;
};

export type SaleFormOptions = {
  customers: SelectOption[];
  locations: SelectOption[];
  taxes: Array<{ id: number; name: string; rate: number }>;
  paymentAccounts: SelectOption[];
  products: SellableProduct[];
};

type CartLine = {
  key: string;
  productId: number;
  isCombo: boolean;
  label: string;
  price: number;
  quantity: number;
  tax: number;
  discount: number;
  stock: number;
};

/** The sale being edited, as `sale::sale.edit` pre-filled its form. */
export type SaleFormDefaults = {
  id: number;
  customerRef: string;
  locationRef: string;
  date: string;
  refNo: string;
  notes: string;
  discountType: string;
  discountValue: number;
  taxId: string;
  shippingCharge: number;
  otherCharge: number;
  lines: Array<{
    productId: number;
    isCombo: boolean;
    label: string;
    price: number;
    quantity: number;
    tax: number;
    discount: number;
    stock: number;
  }>;
};

export function SaleForm({
  options,
  action,
  currencySymbol,
  defaultLocation,
  heading = 'New Sale',
  defaults,
  submitLabel,
}: {
  options: SaleFormOptions;
  action: (prev: SaleFormState, formData: FormData) => Promise<SaleFormState>;
  currencySymbol: string;
  defaultLocation?: string;
  heading?: string;
  defaults?: SaleFormDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  const [lines, setLines] = useState<CartLine[]>(
    defaults?.lines.map((l) => ({
      key: `${l.isCombo ? 'c' : 'p'}-${l.productId}`,
      productId: l.productId,
      isCombo: l.isCombo,
      label: l.label,
      price: l.price,
      quantity: l.quantity,
      tax: l.tax,
      discount: l.discount,
      stock: l.stock,
    })) ?? [],
  );
  const [picked, setPicked] = useState('');
  const [discountType, setDiscountType] = useState(defaults?.discountType ?? '1');
  const [discountValue, setDiscountValue] = useState(defaults?.discountValue ?? 0);
  const [taxId, setTaxId] = useState(defaults?.taxId ?? '0');
  const [shipping, setShipping] = useState(defaults?.shippingCharge ?? 0);
  const [other, setOther] = useState(defaults?.otherCharge ?? 0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [accountId, setAccountId] = useState('');

  const addLine = (value: string) => {
    if (!value) return;
    const product = options.products.find((p) => String(p.id) === value.split(':')[1]);
    if (!product) return;

    setLines((prev) => {
      const existing = prev.find(
        (l) => l.productId === product.id && l.isCombo === Boolean(product.isCombo),
      );
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: `${product.isCombo ? 'c' : 'p'}-${product.id}`,
          productId: product.id,
          isCombo: Boolean(product.isCombo),
          label: product.label,
          price: product.sellingPrice,
          quantity: 1,
          tax: product.tax,
          discount: 0,
          stock: product.stock,
        },
      ];
    });
    setPicked('');
  };

  const patchLine = (key: string, patch: Partial<CartLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const totals = useMemo(() => {
    let itemAmount = 0;
    let totalQuantity = 0;

    for (const line of lines) {
      const lineTotal = line.price * line.quantity;
      const lineTax = (lineTotal * line.tax) / 100;
      const lineDiscount = (lineTotal * line.discount) / 100;
      itemAmount += lineTotal + lineTax - lineDiscount;
      totalQuantity += line.quantity;
    }

    // Invoice discount: type 1 is a fixed amount, type 2 a percentage.
    const invoiceDiscount =
      discountType === '2' ? (itemAmount * discountValue) / 100 : discountValue;

    const selectedTax = options.taxes.find((t) => String(t.id) === taxId);
    const invoiceTax = selectedTax
      ? ((itemAmount - invoiceDiscount) * selectedTax.rate) / 100
      : 0;

    const payable = itemAmount - invoiceDiscount + invoiceTax + shipping + other;

    return {
      itemAmount,
      totalQuantity,
      invoiceDiscount,
      invoiceTax,
      taxRate: selectedTax?.rate ?? 0,
      payable,
    };
  }, [lines, discountType, discountValue, taxId, shipping, other, options.taxes]);

  const money = (value: number) => `${currencySymbol} ${value.toFixed(2)}`;

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert variant="error" message={state.error} />

      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

      {/* Values the server action reads back. */}
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

      <Card title={heading}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            label="Customer"
            name="customer_id"
            required
            placeholder="Select customer"
            defaultValue={defaults?.customerRef ?? ''}
            options={options.customers}
            error={state.fieldErrors?.customer_id}
          />
          <FormSelect
            label="Branch / Warehouse"
            name="warehouse_id"
            required
            placeholder="Select location"
            defaultValue={defaults?.locationRef ?? defaultLocation ?? ''}
            options={options.locations}
            error={state.fieldErrors?.warehouse_id}
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
        </div>
      </Card>

      <Card title="Products" desc="Pick a product to add it to the invoice.">
        <div className="mb-4 max-w-md">
          <FormSelect
            label="Add product"
            name="_picker"
            value={picked}
            onChange={(e) => addLine(e.target.value)}
            placeholder="Search and select a product"
            options={options.products.map((p) => ({
              value: `${p.isCombo ? 'combo' : 'sku'}:${p.id}`,
              label: `${p.label} - ${money(p.sellingPrice)} (stock ${p.stock})`,
            }))}
          />
        </div>

        {state.fieldErrors?.items ? (
          <p className="mb-3 text-xs text-error-500">{state.fieldErrors.items}</p>
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
                <Td className="font-medium text-gray-700 dark:text-gray-300">
                  {line.label}
                  <input
                    type="hidden"
                    name={line.isCombo ? 'combo_product_id' : 'items'}
                    value={line.productId}
                  />
                </Td>
                <Td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name={line.isCombo ? 'combo_product_price' : 'item_price'}
                    value={line.price}
                    onChange={(e) =>
                      patchLine(line.key, { price: Number(e.target.value) })
                    }
                    className="h-9 w-24 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </Td>
                <Td>
                  <input
                    type="number"
                    min="1"
                    name={line.isCombo ? 'combo_product_quantity' : 'item_quantity'}
                    value={line.quantity}
                    onChange={(e) =>
                      patchLine(line.key, { quantity: Number(e.target.value) })
                    }
                    className="h-9 w-20 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                  {!line.isCombo && line.quantity > line.stock ? (
                    <p className="mt-1 text-theme-xs text-error-500">
                      Only {line.stock} in stock
                    </p>
                  ) : null}
                </Td>
                <Td>
                  {line.isCombo ? (
                    '-'
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="product_tax"
                      value={line.tax}
                      onChange={(e) =>
                        patchLine(line.key, { tax: Number(e.target.value) })
                      }
                      className="h-9 w-20 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  )}
                </Td>
                <Td>
                  {line.isCombo ? (
                    '-'
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="item_discount"
                      value={line.discount}
                      onChange={(e) =>
                        patchLine(line.key, { discount: Number(e.target.value) })
                      }
                      className="h-9 w-20 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  )}
                </Td>
                <Td className="font-medium">{money(subTotal)}</Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="rounded-lg px-2 py-1 text-theme-xs font-medium text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                  >
                    Remove
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
              label={discountType === '2' ? 'Discount (%)' : 'Discount amount'}
              name="_discount_value"
              type="number"
              step="0.01"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
            />
            <FormSelect
              label="Invoice Tax"
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
            <FormInput label="Shipping Name" name="shipping_name" />
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
              <Row
                label="Payable"
                value={money(totals.payable)}
                strong
              />
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
                { value: 'quick cash', label: 'Quick Cash' },
                { value: 'bank', label: 'Bank' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'card', label: 'Card' },
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

            {paymentMethod && paymentMethod !== 'cash' && paymentMethod !== 'quick cash' ? (
              <>
                <FormSelect
                  label="Bank Account"
                  name="account_id"
                  placeholder="Select account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  options={options.paymentAccounts}
                />
                <FormInput label="Bank Name" name="bank_name" />
                <FormInput label="Branch" name="branch" />
              </>
            ) : null}

            {paymentAmount > 0 ? (
              <p className="sm:col-span-2 text-sm text-gray-500 dark:text-gray-400">
                Due after payment:{' '}
                <strong>{money(Math.max(0, totals.payable - paymentAmount))}</strong>
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={ROUTES['sale.index']}
          className="rounded-lg px-5 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700"
        >
          Cancel
        </Link>
        <SubmitButton disabled={lines.length === 0}>{submitLabel ?? 'Save Sale'}</SubmitButton>
      </div>
    </form>
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
