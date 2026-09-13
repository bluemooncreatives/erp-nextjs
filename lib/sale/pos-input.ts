import { readPayments, readSaleInput } from './input';

/** Recompute checkout totals; never trust the hidden browser totals. */
export function posInput(form: FormData) {
  const input = readSaleInput(form);
  const payments = readPayments(form);
  if (!/^customer-[1-9]\d*$/.test(input.customerRef)) throw new Error('Select a customer.');
  if (!/^(showroom|warehouse)-[1-9]\d*$/.test(input.locationRef)) throw new Error('Select a location.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw new Error('Select a valid date.');
  for (const [id, columns] of [['items', ['item_price', 'item_quantity', 'product_tax', 'item_discount']], ['combo_product_id', ['combo_product_price', 'combo_product_quantity']]] as const) {
    const count = form.getAll(id).length;
    if (form.getAll(id).some((v) => !Number.isSafeInteger(Number(v)) || Number(v) < 1)) throw new Error('Invalid product identifiers.');
    for (const column of columns) {
      const values = form.getAll(column);
      if (values.length !== count || values.some((v) => String(v).trim() === '' || !Number.isFinite(Number(v)))) throw new Error('Invalid cart values.');
    }
  }
  if (!input.lines.length) throw new Error('Add at least one product.');
  const seen = new Set<string>();
  for (const line of input.lines) {
    const key = `${!!line.isCombo}:${line.productableId}`;
    if (seen.has(key) || !Number.isSafeInteger(line.productableId) || line.productableId < 1 || line.quantity <= 0 || line.price < 0 || line.tax < 0 || line.tax > 100 || line.discount < 0 || line.discount > 100) throw new Error('Invalid product, quantity, price, tax or discount.');
    seen.add(key);
  }
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  input.itemAmount = round(input.lines.reduce((sum, l) => sum + l.price * l.quantity * (1 + (l.tax - l.discount) / 100), 0));
  input.totalQuantity = input.lines.reduce((sum, l) => sum + l.quantity, 0);
  const discount = Number(form.get('_discount_value') ?? 0);
  for (const value of [discount, input.shippingCharge, input.otherCharge]) if (!Number.isFinite(value) || value < 0) throw new Error('Charges and discount must be positive amounts.');
  if (![1, 2].includes(input.discountType)) throw new Error('Invalid discount type.');
  input.totalDiscountAmount = round(input.discountType === 2 ? input.itemAmount * discount / 100 : discount);
  input.totalDiscount = discount;
  if (input.totalDiscountAmount > input.itemAmount) throw new Error('Discount exceeds the cart amount.');
  input.saleType = 2;
  input.quotationId = null;
  for (const key of ['shipping_charge', 'other_charge', '_discount_value', 'discount_type']) {
    const value = form.get(key);
    if (value !== null && (String(value).trim() === '' || !Number.isFinite(Number(value)))) throw new Error('Invalid charges or discount.');
  }
  for (const line of input.lines) line.partNumberIds = line.isCombo ? [] : form.getAll(`serial_no_${line.productSkuId}`).map(Number);
  // Tax is loaded from the database by checkoutPos.
  const taxId = Number(form.get('_tax_id') ?? 0);
  if (!Number.isSafeInteger(taxId) || taxId < 0) throw new Error('Invalid invoice tax.');
  const methods = form.getAll('payment_method');
  const amounts = form.getAll('payment_amount');
  if (methods.length !== amounts.length || amounts.some((v) => !Number.isFinite(Number(v)) || Number(v) < 0)) throw new Error('Invalid payment amounts.');
  for (const p of payments) {
    if (!['cash', 'quick cash', 'bank', 'cheque', 'card'].includes(p.paymentMethod)) throw new Error('Invalid payment method.');
    if (!['cash', 'quick cash'].includes(p.paymentMethod) && (!p.accountId || p.accountId < 1)) throw new Error('Select a payment account.');
  }
  return { input, payments, taxId };
}
