import type { SaleInput, SaleLineInput, PaymentInput } from './repository';

export function num(formData: FormData, key: string, fallback = 0): number {
  const raw = formData.get(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

export function numList(formData: FormData, key: string): number[] {
  return formData.getAll(key).map((v) => Number(v)).filter(Number.isFinite);
}

/**
 * Read the cart rows. The form posts one set of parallel arrays for SKU lines
 * and another for combo lines, as the Blade cart did.
 */
function readLines(formData: FormData): SaleLineInput[] {
  const lines: SaleLineInput[] = [];

  const skuIds = numList(formData, 'items');
  const skuPrices = numList(formData, 'item_price');
  const skuQuantities = numList(formData, 'item_quantity');
  const skuTaxes = numList(formData, 'product_tax');
  const skuDiscounts = numList(formData, 'item_discount');
  const serials = numList(formData, 'serial_no');

  for (let i = 0; i < skuIds.length; i++) {
    lines.push({
      productableId: skuIds[i],
      productSkuId: skuIds[i],
      price: skuPrices[i] ?? 0,
      quantity: skuQuantities[i] ?? 0,
      tax: skuTaxes[i] ?? 0,
      discount: skuDiscounts[i] ?? 0,
      // Serials are posted as one flat list; they are matched to their SKU by
      // the repository when it writes the join rows.
      partNumberIds: i === 0 ? serials : [],
    });
  }

  const comboIds = numList(formData, 'combo_product_id');
  const comboPrices = numList(formData, 'combo_product_price');
  const comboQuantities = numList(formData, 'combo_product_quantity');

  for (let i = 0; i < comboIds.length; i++) {
    lines.push({
      productableId: comboIds[i],
      productSkuId: comboIds[i],
      isCombo: true,
      price: comboPrices[i] ?? 0,
      quantity: comboQuantities[i] ?? 0,
      tax: 0,
      discount: 0,
    });
  }

  return lines;
}

export function readSaleInput(formData: FormData): SaleInput {
  return {
    customerRef: String(formData.get('customer_id') ?? ''),
    locationRef: String(formData.get('warehouse_id') ?? ''),
    refNo: str(formData, 'ref_no'),
    invoiceNo: str(formData, 'invoice_no'),
    date: String(formData.get('date') ?? ''),
    notes: str(formData, 'notes'),
    saleType: formData.get('sale_type') ? num(formData, 'sale_type') : 1,

    itemAmount: num(formData, 'item_amount'),
    totalQuantity: num(formData, 'total_quantity'),
    totalTax: String(formData.get('total_tax') ?? '0-0'),
    shippingCharge: num(formData, 'shipping_charge'),
    otherCharge: num(formData, 'other_charge'),
    totalDiscountAmount: num(formData, 'total_discount_amount'),
    discountType: num(formData, 'discount_type', 1),
    totalDiscount: num(formData, 'total_discount'),
    totalAmount: num(formData, 'total_amount'),

    shippingName: str(formData, 'shipping_name'),
    quotationId: formData.get('quotation_id') ? num(formData, 'quotation_id') : null,

    lines: readLines(formData),
  };
}

/** `SaleRequest` - a customer, a location and at least one line. */
export function validate(input: SaleInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.customerRef) errors.customer_id = 'Please select a customer.';
  if (!input.locationRef) errors.warehouse_id = 'Select Warehouse or Showroom';
  if (!input.date) errors.date = 'The date field is required.';
  if (input.lines.length === 0) errors.items = 'Add at least one product.';
  return Object.keys(errors).length ? errors : null;
}

/** Payment rows posted alongside the sale. */
export function readPayments(formData: FormData): PaymentInput[] {
  const methods = formData.getAll('payment_method').map(String);
  const amounts = numList(formData, 'payment_amount');
  const accountIds = formData.getAll('account_id').map((v) => Number(v));
  const bankNames = formData.getAll('bank_name').map(String);
  const branches = formData.getAll('branch').map(String);

  const out: PaymentInput[] = [];
  for (let i = 0; i < methods.length; i++) {
    const amount = amounts[i] ?? 0;
    if (!methods[i] || amount <= 0) continue;
    out.push({
      paymentMethod: methods[i],
      amount,
      accountId: Number.isFinite(accountIds[i]) ? accountIds[i] : null,
      bankName: bankNames[i] || null,
      branch: branches[i] || null,
    });
  }
  return out;
}

