'use server';

// ---------------------------------------------------------------------------
// Sale server actions - port of Modules/Sale/Http/Controllers/SaleController.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES, route } from '@/lib/routes';
import {
  INSUFFICIENT_STOCK,
  acceptSaleDelivery,
  approveSale,
  approveSaleReturn,
  createSale,
  updateSale,
  deleteSale,
  markSaleMailed,
  quotationToSale,
  recordSalePayments,
  recordSaleReturn,
  saveShipping,
  type PaymentInput,
  type SaleInput,
  type SaleLineInput,
} from '@/lib/sale/repository';
import { saveUpload, fileFrom } from '@/lib/uploads';
import { findSale } from '@/lib/sale/queries';
import { sendSaleMail } from '@/lib/mail';
import { isEnabled } from '@/lib/business-settings';
import { config } from '@/lib/config';
import { actionFormData } from '@/lib/forms';

export type SaleFormState = {
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

function readSaleInput(formData: FormData): SaleInput {
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
function validate(input: SaleInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.customerRef) errors.customer_id = 'Please select a customer.';
  if (!input.locationRef) errors.warehouse_id = 'Select Warehouse or Showroom';
  if (!input.date) errors.date = 'The date field is required.';
  if (input.lines.length === 0) errors.items = 'Add at least one product.';
  return Object.keys(errors).length ? errors : null;
}

/** Payment rows posted alongside the sale. */
function readPayments(formData: FormData): PaymentInput[] {
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

// --- Create ---------------------------------------------------------------

export async function storeSale(
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  formData = actionFormData(_prev, formData);
  const input = readSaleInput(formData);
  const fieldErrors = validate(input);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize('sale.store');

  let saleId: number;
  try {
    const result = await createSale(input, user.id);
    if (result === INSUFFICIENT_STOCK) {
      return { error: 'Not enough stock for one of the selected products.' };
    }
    saleId = result;

    const paymentInputs = readPayments(formData);
    if (paymentInputs.length) {
      await recordSalePayments(saleId, paymentInputs, user.id, true);
    }

    // `if ($request->send_mail == 1) $this->send_mail_quotation($sale->id);`
    if (formData.get('send_mail')) {
      await mailSaleInvoice(saleId, user.id);
    }

    await successLog(`Sale created: ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['sale.index']);

  // `if ($request->preview_status == 1) return redirect()->route('sale.edit', ...)`
  if (formData.get('preview_status')) {
    redirect(route('sale.edit', { id: saleId }));
  }

  // Otherwise the controller approved the sale straight away when the
  // `sale_approval` business setting was on.
  if (await isEnabled('sale_approval')) {
    try {
      await approveSale(saleId, user.id);
      await successLog(`Sale approved: ${saleId}`, user.id);
    } catch (error) {
      await errorLog(String(error), user.id);
    }
  }

  redirect(route('sale.show', { id: saleId }));
}

/**
 * `send_mail_quotation($id)` - mail the invoice to the customer and stamp
 * `mail_status`. The PHP reported a missing customer email to the user; here it
 * is recorded in the activity log, since the action redirects on success.
 */
async function mailSaleInvoice(saleId: number, userId: number): Promise<void> {
  const record = await findSale(saleId);
  const email = record?.customer?.email;
  if (!record || !email) {
    await errorLog(`Customer email doesn't exist for sale ${saleId}`, userId);
    return;
  }

  const sent = await sendSaleMail({
    to: email,
    customerName: record.customer?.name ?? '',
    invoiceNo: record.sale.invoiceNo ?? String(saleId),
    invoiceUrl: `${config.app.url}${route('sale.print_view', { id: saleId })}`,
  });

  if (sent) {
    await markSaleMailed(saleId);
    await successLog(`Mail sent to ${email} for sale ${saleId}`, userId);
  }
}

/** `SaleController@update` */
export async function saveSale(
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  formData = actionFormData(_prev, formData);
  const saleId = Number(formData.get('id'));
  if (!Number.isFinite(saleId)) return { error: 'Missing sale id.' };

  const input = readSaleInput(formData);
  const fieldErrors = validate(input);
  if (fieldErrors) return { fieldErrors };

  const user = await authorize('sale.update');

  try {
    const result = await updateSale(saleId, input, user.id);
    if (result === INSUFFICIENT_STOCK) {
      return { error: 'Your stock is out' };
    }
    await successLog('Sale Updated Successfully without Payment', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['sale.index']);
  redirect(route('sale.show', { id: saleId }));
}

// --- Payments -------------------------------------------------------------

export async function addSalePayment(
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  formData = actionFormData(_prev, formData);
  const saleId = Number(formData.get('sale_id'));
  if (!Number.isFinite(saleId)) return { error: 'Missing sale id.' };

  const user = await authorize('sale.payment');
  const paymentInputs = readPayments(formData);
  if (!paymentInputs.length) return { error: 'Enter a payment amount.' };

  try {
    await recordSalePayments(saleId, paymentInputs, user.id);
    await successLog(`Payment recorded for sale ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(route('sale.show', { id: saleId }));
  revalidatePath(ROUTES['sale.index']);
  return { success: 'Payment recorded.' };
}

// --- Approval -------------------------------------------------------------

export async function approveSaleAction(formData: FormData): Promise<void> {
  const saleId = Number(formData.get('id'));
  const user = await authorize('conditional.sale.approve');

  try {
    await approveSale(saleId, user.id);
    await successLog(`Sale approved: ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['sale.index']);
  revalidatePath(route('sale.show', { id: saleId }));
}

// --- Returns --------------------------------------------------------------

export async function storeSaleReturn(
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  formData = actionFormData(_prev, formData);
  const saleId = Number(formData.get('sale_id'));
  if (!Number.isFinite(saleId)) return { error: 'Missing sale id.' };

  const user = await authorize('sale.return');

  const itemIds = numList(formData, 'item_id');
  const quantities = numList(formData, 'return_quantity');
  const lines = itemIds.map((itemId, i) => ({
    itemId,
    quantity: quantities[i] ?? 0,
  }));

  try {
    await recordSaleReturn(saleId, lines, user.id, {
      returnNote: str(formData, 'return_note'),
      returnedPartNumberIds: numList(formData, 'item_serial_no'),
    });
    await successLog(`Sale return recorded: ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['sale.return.index']);
  redirect(ROUTES['sale.return.index']);
}

export async function approveSaleReturnAction(formData: FormData): Promise<void> {
  const saleId = Number(formData.get('id'));
  const user = await authorize('return.sale.approve');

  try {
    await approveSaleReturn(saleId, user.id);
    await successLog(`Sale return approved: ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['sale.return.index']);
}

// --- Delete ---------------------------------------------------------------

export async function deleteSaleAction(formData: FormData): Promise<void> {
  const saleId = Number(formData.get('id'));
  const user = await authorize('sale.delete');

  try {
    await deleteSale(saleId);
    await successLog(`Sale deleted: ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['sale.index']);
}

// --- Shipping -------------------------------------------------------------

export async function storeShipping(
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  formData = actionFormData(_prev, formData);
  const saleId = Number(formData.get('sale_id'));
  const user = await authorize('store.shipping');

  try {
    await saveShipping({
      id: formData.get('id') ? Number(formData.get('id')) : null,
      saleId,
      shippingName: str(formData, 'shipping_name'),
      shippingRef: str(formData, 'shipping_ref'),
      date: str(formData, 'shipping_date'),
      receivedDate: str(formData, 'received_date'),
      receivedBy: str(formData, 'received_by'),
      bookingSlip: await saveUpload(fileFrom(formData, 'booking_slip'), 'sale/booking_slip'),
      proveOfDelivery: await saveUpload(
        fileFrom(formData, 'prove_of_delivery'),
        'sale/prove_of_delivery',
      ),
    });
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(route('sale.show', { id: saleId }));
  return { success: 'Shipping saved.' };
}

/** `acceptOrder()` - the customer confirms delivery. */
export async function acceptDelivery(formData: FormData): Promise<void> {
  const saleId = Number(formData.get('id'));
  await authorize('sale.order.receive');

  await acceptSaleDelivery(
    saleId,
    String(formData.get('name') ?? ''),
    String(formData.get('delivery_date') ?? ''),
  );

  revalidatePath(route('sale.show', { id: saleId }));
}

// --- Quotation conversion --------------------------------------------------

export async function convertQuotationToSale(formData: FormData): Promise<void> {
  const quotationId = Number(formData.get('quotation_id'));
  const user = await authorize('sale.store');

  const saleId = await quotationToSale(quotationId, user.id);
  if (!saleId) return;

  await successLog(`Quotation ${quotationId} converted to sale ${saleId}`, user.id);
  revalidatePath(ROUTES['sale.index']);
  redirect(route('sale.show', { id: saleId }));
}
