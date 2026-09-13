'use client';

import { LinkButton } from '@/components/common/link-button';
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

import { useActionState, useMemo, useState, useTransition } from 'react';
import { nanoid } from 'nanoid';
import { Card } from '@/components/erp/page';
import { customerLookup, type CustomerLookup } from './actions';
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
import { Phrase } from '@/context/TranslationContext';

const INITIAL: SaleFormState = {};

export type SellableProduct = {
  id: number;
  label: string;
  sellingPrice: number;
  minSellingPrice: number;
  tax: number;
  stock: number;
  isCombo?: boolean;
  serialNumbers?: { id: number; label: string }[];
  barcode?: string | null;
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
  /**
   * The row being edited. Omitted when the form is seeded from another
   * document - a clone, or a quotation being converted - because those post a
   * new record and must not carry the source's id.
   */
  id?: number;
  customerRef: string;
  locationRef: string;
  date: string;
  refNo: string;
  invoiceNo?: string;
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
  quotationId,
  pos = false,
}: {
  options: SaleFormOptions;
  action: (prev: SaleFormState, formData: FormData) => Promise<SaleFormState>;
  currencySymbol: string;
  defaultLocation?: string;
  heading?: string;
  defaults?: SaleFormDefaults;
  submitLabel?: string;
  /**
   * Set when the form was opened from a quotation. `SaleRepository::create`
   * marks that quotation converted once the sale is stored, which is how the
   * PHP flow closed the loop - the conversion screen itself wrote nothing.
   */
  quotationId?: number;
  pos?: boolean;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  // One id per mount, not per submit - a double-click or a dropped-response
  // retry resubmits the same in-flight checkout under the same id, so the
  // action can recognise it as the same attempt instead of ringing it up
  // twice. A genuinely new checkout only happens after the page remounts
  // (the previous one redirected to its receipt), which mints a new id.
  const [checkoutNonce] = useState(() => (pos ? nanoid() : ''));

  // Which button submitted the form - the Blade set these hidden fields from
  // its three save buttons.
  const [sendMail, setSendMail] = useState(false);
  const [preview, setPreview] = useState(false);
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
  const [search, setSearch] = useState('');
  const [discountType, setDiscountType] = useState(defaults?.discountType ?? '1');
  const [discountValue, setDiscountValue] = useState(defaults?.discountValue ?? 0);
  const [taxId, setTaxId] = useState(defaults?.taxId ?? '0');
  const [shipping, setShipping] = useState(defaults?.shippingCharge ?? 0);
  const [other, setOther] = useState(defaults?.otherCharge ?? 0);
  const [paymentMethod, setPaymentMethod] = useState(pos ? 'quick cash' : '');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [customerInfo, setCustomerInfo] = useState<CustomerLookup | null>(null);
  const [, startCustomerLookup] = useTransition();
  const lookupCustomer = (ref: string) => {
    if (!ref) { setCustomerInfo(null); return; }
    startCustomerLookup(async () => setCustomerInfo(await customerLookup(ref)));
  };
  const [extraPayments, setExtraPayments] = useState<{ key: number; method: string; amount: number; account: string }[]>([]);
  const totalPaid = paymentAmount + extraPayments.reduce((sum, p) => sum + p.amount, 0);

  const addLine = (value: string) => {
    if (!value) return;
    const product = options.products.find((p) => String(p.id) === value.split(':')[1] && Boolean(p.isCombo) === (value.split(':')[0] === 'combo'));
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

      {pos ? <input type="hidden" name="checkout_nonce" value={checkoutNonce} /> : null}
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {quotationId ? (
        <input type="hidden" name="quotation_id" value={quotationId} />
      ) : null}

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
          <div>
            <FormSelect
              label="Customer"
              name="customer_id"
              required
              placeholder="Select customer"
              defaultValue={defaults?.customerRef ?? ''}
              options={options.customers}
              error={state.fieldErrors?.customer_id}
              onChange={(e) => lookupCustomer(e.target.value)}
            />
            {customerInfo ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Due: {money(customerInfo.due)}
                {customerInfo.lastInvoiceNo ? (
                  <>
                    {' — Last invoice: '}
                    {customerInfo.lastInvoiceUrl ? (
                      <a href={customerInfo.lastInvoiceUrl} className="underline" target="_blank" rel="noreferrer">
                        {customerInfo.lastInvoiceNo}
                      </a>
                    ) : customerInfo.lastInvoiceNo}
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
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
          <FormInput
            label="Invoice No"
            name="invoice_no"
            placeholder="Generated automatically when empty"
            defaultValue={defaults?.invoiceNo ?? ''}
          />
        </div>
      </Card>

      <Card title="Products" desc="Pick a product to add it to the invoice.">
        {pos ? <div className="mb-5 space-y-3">
          <FormInput label="Search or scan SKU" name="_search" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const term = search.trim().toLowerCase();
              const found = options.products.find((p) => p.barcode?.toLowerCase() === term || p.label.toLowerCase().endsWith(`(${term})`)) ?? options.products.find((p) => p.label.toLowerCase().includes(term));
              if (found && search.trim()) { addLine(`${found.isCombo ? 'combo' : 'sku'}:${found.id}`); setSearch(''); }
            }} />
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-auto md:grid-cols-4">
            {options.products.filter((p) => p.label.toLowerCase().includes(search.toLowerCase())).map((p) =>
              <button key={`${p.isCombo ? 'combo' : 'sku'}:${p.id}`} type="button"
                className="rounded-lg border border-border p-3 text-start hover:bg-muted"
                onClick={() => addLine(`${p.isCombo ? 'combo' : 'sku'}:${p.id}`)}>
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="text-xs text-muted-foreground">{money(p.sellingPrice)}</span>
              </button>)}
          </div>
        </div> : null}
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
                  {pos && !line.isCombo && options.products.find((p) => p.id === line.productId && !p.isCombo)?.serialNumbers?.length ? <div className="mt-2 max-h-24 overflow-auto">
                    {options.products.find((p) => p.id === line.productId && !p.isCombo)?.serialNumbers?.map((serial) => <label key={serial.id} className="block text-xs"><input type="checkbox" name={`serial_no_${line.productId}`} value={serial.id} /> {serial.label}</label>)}
                  </div> : null}
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
                    className="h-9 w-24 rounded-lg border border-border bg-transparent px-2 text-sm"
                  />
                </Td>
                <Td>
                  <input
                    type="number"
                    min="1"
                    name={line.isCombo ? 'combo_product_quantity':'item_quantity'}
                    value={line.quantity}
                    onChange={(e) =>
                      patchLine(line.key, { quantity: Number(e.target.value) })
                    }
                    className="h-9 w-20 rounded-lg border border-border bg-transparent px-2 text-sm"
                  />
                  {!line.isCombo && line.quantity > line.stock ? (
                    <p className="mt-1 text-xs text-destructive">
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
                      className="h-9 w-20 rounded-lg border border-border bg-transparent px-2 text-sm"
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
                      className="h-9 w-20 rounded-lg border border-border bg-transparent px-2 text-sm"
                    />
                  )}
                </Td>
                <Td className="font-medium">{money(subTotal)}</Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
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
            <div className="border-t border-border pt-3">
              <Row
                label="Payable"
                value={money(totals.payable)}
                strong
              />
            </div>
          </dl>

          {pos ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Quick tender</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                  onClick={() => setPaymentAmount(totals.payable)}
                >
                  Exact {money(totals.payable)}
                </button>
                {[1, 5, 10, 20, 50, 100, 500, 1000].map((bill) =>
                  bill > totals.payable ? (
                    <button
                      key={bill}
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => setPaymentAmount(bill)}
                    >
                      {currencySymbol}{bill}
                    </button>
                  ) : null
                )}
              </div>
            </div>
          ) : null}
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
                { value: 'bank', label:'Bank' },
                { value: 'cheque', label:'Cheque' },
                { value: 'card', label:'Card' },
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

            {(!paymentMethod || paymentMethod === 'cash' || paymentMethod === 'quick cash') ? <><input type="hidden" name="account_id" value="" /><input type="hidden" name="bank_name" value="" /><input type="hidden" name="branch" value="" /></> : null}
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

            {pos ? (
              // POS-mode payment summary: always visible, colour-coded.
              <div className="sm:col-span-2 mt-1">
                {(() => {
                  const diff = totalPaid - totals.payable;
                  const isQuickCash = paymentMethod === 'quick cash';
                  const isChange = isQuickCash && diff > 0;
                  const isUnderpaid = totalPaid > 0 && diff < -0.009;
                  const isExact = totalPaid > 0 && Math.abs(diff) <= 0.009;
                  return (
                    <div
                      className={`rounded-lg p-3 text-center text-sm font-semibold transition-colors ${
                        isChange
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : isUnderpaid
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : isExact
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      {isChange ? (
                        <>
                          <span className="block text-xs font-normal">Change due</span>
                          <span className="text-xl">{money(diff)}</span>
                        </>
                      ) : isUnderpaid ? (
                        <>
                          <span className="block text-xs font-normal">Still to collect</span>
                          <span className="text-xl">{money(-diff)}</span>
                        </>
                      ) : isExact ? (
                        <span>Paid in full ✓</span>
                      ) : (
                        <>
                          <span className="block text-xs font-normal">Balance due</span>
                          <span className="text-xl">{money(totals.payable)}</span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : totalPaid > 0 ? (
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                Due after payment:{' '}
                <strong>{money(Math.max(0, totals.payable - totalPaid))}</strong>
              </p>
            ) : null}
          </div>
          {pos ? <div className="mt-4 space-y-3">
            {extraPayments.map((payment) => <div key={payment.key} className="grid gap-2 rounded border border-border p-3 sm:grid-cols-3">
              <select name="payment_method" aria-label="Additional payment method" className="rounded border bg-background p-2" value={payment.method} onChange={(e) => setExtraPayments((rows) => rows.map((r) => r.key === payment.key ? { ...r, method: e.target.value } : r))}>{['cash', 'bank', 'card', 'cheque'].map((m) => <option key={m}>{m}</option>)}</select>
              <input name="payment_amount" aria-label="Additional payment amount" type="number" min="0" step="0.01" className="rounded border bg-background p-2" value={payment.amount} onChange={(e) => setExtraPayments((rows) => rows.map((r) => r.key === payment.key ? { ...r, amount: Number(e.target.value) } : r))} />
              <select name="account_id" aria-label="Additional payment account" className="rounded border bg-background p-2" value={payment.account} onChange={(e) => setExtraPayments((rows) => rows.map((r) => r.key === payment.key ? { ...r, account: e.target.value } : r))}><option value="">Select account</option>{options.paymentAccounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
              <input type="hidden" name="bank_name" value="" /><input type="hidden" name="branch" value="" />
              <button type="button" onClick={() => setExtraPayments((rows) => rows.filter((r) => r.key !== payment.key))}>Remove payment</button>
            </div>)}
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setExtraPayments((rows) => [...rows, { key: Date.now(), method: 'cash', amount: 0, account: '' }])}>Add payment</button>
          </div> : null}
        </Card>
      </div>

      {/* The Blade's three buttons: plain save, save and mail the invoice, and
          save then reopen the sale for a preview. */}
      <input type="hidden" name="send_mail" value={sendMail ? '1' : ''} />
      <input type="hidden" name="preview_status" value={preview ? '1' : ''} />

      <div className="flex items-center justify-end gap-3">
        <LinkButton
          href={ROUTES['sale.index']}
          variant="outline"
        >
          <Phrase>Cancel</Phrase>
        </LinkButton>
        {!pos ? <button
          type="submit"
          disabled={lines.length === 0}
          onClick={() => {
            setSendMail(false);
            setPreview(true);
          }}
          className="rounded-lg px-5 py-3 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted disabled:opacity-50"
        >
          Save &amp; Preview
        </button> : null}
        {!pos ? <button
          type="submit"
          disabled={lines.length === 0}
          onClick={() => {
            setPreview(false);
            setSendMail(true);
          }}
          className="rounded-lg px-5 py-3 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted disabled:opacity-50"
        >
          Save &amp; Send Mail
        </button> : null}
        <SubmitButton
          disabled={lines.length === 0}
          onClick={() => {
            setSendMail(false);
            setPreview(false);
          }}
        >
          {submitLabel ?? 'Save Sale'}
        </SubmitButton>
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
