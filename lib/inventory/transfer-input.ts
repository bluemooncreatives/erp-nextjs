import type { TransferInput } from './transfers';

export function transferInput(form: FormData): { data: TransferInput; fieldErrors: Record<string, string> } {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const ids = form.getAll('product_id').map(Number);
  const quantities = form.getAll('quantity').map(Number);
  const prices = form.getAll('product_price').map(Number);
  const fieldErrors: Record<string, string> = {};
  const fromRef = text('from'), toRef = text('to'), date = text('date');
  const location = /^(warehouse|showroom)-[1-9]\d*$/;
  if (!location.test(fromRef)) fieldErrors.from = 'Select the sending location.';
  if (!location.test(toRef) || fromRef === toRef) fieldErrors.to = 'Select a different receiving location.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fieldErrors.date = 'Enter a valid date.';
  if (!ids.length || ids.length !== quantities.length || ids.length !== prices.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1) || quantities.some((qty) => !Number.isFinite(qty) || qty <= 0) || prices.some((price) => !Number.isFinite(price) || price < 0) || new Set(ids).size !== ids.length) fieldErrors.product_id = 'Add valid products, prices, and positive quantities.';
  return { fieldErrors, data: { fromRef, toRef, date, notes: text('notes') || null, lines: ids.map((productSkuId, index) => ({ productSkuId, quantity: quantities[index], price: prices[index] })) } };
}
