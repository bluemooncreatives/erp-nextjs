'use server';

// Purchase server actions - port of
// Modules/Purchase/Http/Controllers/PurchaseOrderController.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES, route } from '@/lib/routes';
import { filesFrom, saveUpload } from '@/lib/uploads';
import {
  addOpeningStock,
  approvePurchaseOrder,
  approvePurchaseReturn,
  createPurchaseOrder,
  deletePurchaseOrder,
  recordPurchasePayments,
  recordPurchaseReturn,
  receivePurchaseIntoStock,
  type PurchaseInput,
  type PurchaseLineInput,
  type PurchasePaymentInput,
} from '@/lib/purchase/repository';

export type PurchaseFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

function num(formData: FormData, key: string, fallback = 0): number {
  const raw = formData.get(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

function numList(formData: FormData, key: string): number[] {
  return formData.getAll(key).map((v) => Number(v)).filter(Number.isFinite);
}

function readLines(formData: FormData): PurchaseLineInput[] {
  const ids = numList(formData, 'product_id');
  const prices = numList(formData, 'product_price');
  const sellingPrices = numList(formData, 'product_selling_price');
  const quantities = numList(formData, 'product_quantity');
  const taxRates = numList(formData, 'product_tax');
  const discounts = numList(formData, 'product_discount');

  return ids.map((id, i) => ({
    productSkuId: id,
    price: prices[i] ?? 0,
    sellingPrice: sellingPrices[i] ?? 0,
    quantity: quantities[i] ?? 0,
    tax: taxRates[i] ?? 0,
    discount: discounts[i] ?? 0,
  }));
}

function readPayments(formData: FormData): PurchasePaymentInput[] {
  const methods = formData.getAll('payment_method').map(String);
  const amounts = numList(formData, 'payment_amount');
  const accountIds = formData.getAll('account_id').map((v) => Number(v));
  const bankNames = formData.getAll('bank_name').map(String);
  const branches = formData.getAll('branch').map(String);

  const out: PurchasePaymentInput[] = [];
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

// --- Create ---------------------------------------------------------------

export async function storePurchaseOrder(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const user = await authorize('purchase_order.store');

  const lines = readLines(formData);
  const fieldErrors: Record<string, string> = {};
  if (!formData.get('supplier_id')) fieldErrors.supplier_id = 'Please select a supplier.';
  if (!formData.get('showroom')) fieldErrors.showroom = 'Select Warehouse or Showroom';
  if (!formData.get('date')) fieldErrors.date = 'The date field is required.';
  if (lines.length === 0) fieldErrors.product_id = 'Add at least one product.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  // Supporting documents are stored under public/uploads/purchase_order.
  const documents: string[] = [];
  for (const file of filesFrom(formData, 'documents')) {
    const stored = await saveUpload(file, 'purchase_order');
    if (stored) documents.push(stored);
  }

  const input: PurchaseInput = {
    supplierId: num(formData, 'supplier_id'),
    locationRef: String(formData.get('showroom') ?? ''),
    paymentMethod: str(formData, 'payment_method'),
    shippingAddress: str(formData, 'shipping_address'),
    notes: str(formData, 'notes'),
    documents,
    itemAmount: num(formData, 'item_amount'),
    date: String(formData.get('date') ?? ''),
    totalQuantity: num(formData, 'total_quantity'),
    totalDiscountAmount: num(formData, 'total_discount_amount'),
    totalDiscount: num(formData, 'total_discount'),
    discountType: num(formData, 'discount_type', 2),
    totalAmount: num(formData, 'total_amount'),
    totalTax: String(formData.get('total_tax') ?? '0-0'),
    shippingCharge: num(formData, 'shipping_charge'),
    otherCharge: num(formData, 'other_charge'),
    refNo: str(formData, 'ref_no'),
    lcNo: str(formData, 'lc_no'),
    cnfId: formData.get('cnf_agent') ? num(formData, 'cnf_agent') : null,
    lines,
  };

  let orderId: number | null;
  try {
    orderId = await createPurchaseOrder(input, user.id);
    if (!orderId) return { error: 'Select Warehouse or Showroom' };

    const paymentInputs = readPayments(formData);
    if (paymentInputs.length) {
      await recordPurchasePayments(orderId, paymentInputs, user.id);
    }

    await successLog(`Purchase order created: ${orderId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['purchase_order.index']);
  redirect(route('purchase_order.show', { id: orderId }));
}

// --- Approve --------------------------------------------------------------

export async function approvePurchaseAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get('id'));
  const user = await authorize('purchase.approve');

  try {
    await approvePurchaseOrder(orderId, user.id);
    await successLog(`Purchase order approved: ${orderId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['purchase_order.index']);
  revalidatePath(route('purchase_order.show', { id: orderId }));
}

// --- Receive into stock ----------------------------------------------------

export async function receiveStockAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const orderId = Number(formData.get('purchase_id'));
  const user = await authorize('purchase.add.stock');

  const skuIds = numList(formData, 'product_sku_id');
  const quantities = numList(formData, 'quantity');
  const serials = formData.getAll('serial_no').map(String);

  const lines = skuIds.map((productSkuId, i) => ({
    productSkuId,
    quantity: quantities[i] ?? 0,
    serialNumbers: serials[i] || undefined,
  }));

  try {
    await receivePurchaseIntoStock(orderId, lines, user.id);
    await successLog(`Stock received for purchase ${orderId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['purchase_order.recieve.index']);
  revalidatePath(route('purchase_order.show', { id: orderId }));
  return { success: 'Stock received.' };
}

/** `add_opening_stock_create` - opening stock outside any purchase order. */
export async function storeOpeningStock(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const user = await authorize('add_opening_stock_create');

  const fieldErrors: Record<string, string> = {};
  if (!formData.get('showroom')) fieldErrors.showroom = 'Select Warehouse or Showroom';
  if (!formData.get('product_sku_id')) {
    fieldErrors.product_sku_id = 'Please select a product.';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await addOpeningStock(
      {
        locationRef: String(formData.get('showroom') ?? ''),
        productSkuId: num(formData, 'product_sku_id'),
        quantity: num(formData, 'stock_quantity'),
        stockDate: String(formData.get('stock_date') ?? ''),
        serialNumbers: str(formData, 'serial_no') ?? undefined,
      },
      user.id,
    );
    await successLog('Opening stock added', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['add_opening_stock_create']);
  return { success: 'Opening stock added.' };
}

// --- Payments --------------------------------------------------------------

export async function addPurchasePayment(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const orderId = Number(formData.get('purchase_id'));
  const user = await authorize('purchase.payment');

  const paymentInputs = readPayments(formData);
  if (!paymentInputs.length) return { error: 'Enter a payment amount.' };

  try {
    await recordPurchasePayments(orderId, paymentInputs, user.id);
    await successLog(`Payment recorded for purchase ${orderId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(route('purchase_order.show', { id: orderId }));
  return { success: 'Payment recorded.' };
}

// --- Returns ---------------------------------------------------------------

export async function storePurchaseReturn(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const orderId = Number(formData.get('purchase_id'));
  const user = await authorize('purchase.return.index');

  const itemIds = numList(formData, 'item_id');
  const quantities = numList(formData, 'return_quantity');
  const lines = itemIds.map((itemId, i) => ({
    itemId,
    quantity: quantities[i] ?? 0,
  }));

  try {
    await recordPurchaseReturn(orderId, lines, user.id);
    await successLog(`Purchase return recorded: ${orderId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['purchase.return.index']);
  redirect(ROUTES['purchase.return.index']);
}

export async function approvePurchaseReturnAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get('id'));
  const user = await authorize('return.purchase.approve');

  try {
    await approvePurchaseReturn(orderId, user.id);
    await successLog(`Purchase return approved: ${orderId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['purchase.return.index']);
}

// --- Delete ----------------------------------------------------------------

export async function deletePurchaseAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get('id'));
  const user = await authorize('purchase.order.destroy');

  try {
    await deletePurchaseOrder(orderId);
    await successLog(`Purchase order deleted: ${orderId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['purchase_order.index']);
}
