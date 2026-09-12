import type { AdjustmentInput } from './transfers';

/** Keep parallel form arrays aligned: never filter invalid numbers separately. */
export function adjustmentInput(form: FormData): { data: AdjustmentInput; fieldErrors: Record<string, string> } {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const ids = form.getAll('product_id').map(Number);
  const quantities = form.getAll('product_quantity').map(Number);
  const fieldErrors: Record<string, string> = {};
  const locationRef = text('warehouse_id');
  const date = text('date');
  const recoveryAmount = Number(text('recovery_amount'));
  if (!/^(warehouse|showroom)-[1-9]\d*$/.test(locationRef)) fieldErrors.warehouse_id = 'Select Warehouse or Showroom';
  if (!text('ref_no')) fieldErrors.ref_no = 'The reference number is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fieldErrors.date = 'Enter a valid date.';
  if (!text('recovery_amount') || !Number.isFinite(recoveryAmount) || recoveryAmount < 0) fieldErrors.recovery_amount = 'Enter a valid recovery amount.';
  if (!ids.length || ids.length !== quantities.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1) || quantities.some((qty) => !Number.isFinite(qty) || qty <= 0) || new Set(ids).size !== ids.length) fieldErrors.product_id = 'Add valid products and positive quantities.';
  return { fieldErrors, data: { locationRef, date, recoveryAmount, refNo: text('ref_no'), reason: text('notes') || null, lines: ids.map((productSkuId, index) => ({ productSkuId, quantity: quantities[index] })) } };
}
