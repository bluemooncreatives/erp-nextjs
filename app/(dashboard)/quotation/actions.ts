'use server';

// Quotation server actions - port of QuotationController.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES, route } from '@/lib/routes';
import { filesFrom, saveUpload } from '@/lib/uploads';
import {
  createQuotation,
  deleteQuotation,
  updateQuotation,
  type QuotationInput,
  type QuotationLineInput,
  findQuotation,
  markQuotationMailed,
} from '@/lib/quotation/repository';
import { sendQuotationMail } from '@/lib/mail';
import { config } from '@/lib/config';
import { actionFormData } from '@/lib/forms';

export type QuotationFormState = {
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

function readLines(formData: FormData): QuotationLineInput[] {
  const lines: QuotationLineInput[] = [];

  const skuIds = numList(formData, 'items');
  const prices = numList(formData, 'item_price');
  const quantities = numList(formData, 'item_quantity');
  const taxes = numList(formData, 'product_tax');
  const discounts = numList(formData, 'item_discount');

  for (let i = 0; i < skuIds.length; i++) {
    lines.push({
      productableId: skuIds[i],
      productSkuId: skuIds[i],
      price: prices[i] ?? 0,
      quantity: quantities[i] ?? 0,
      tax: taxes[i] ?? 0,
      discount: discounts[i] ?? 0,
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

async function readInput(formData: FormData): Promise<QuotationInput> {
  const documents: string[] = [];
  for (const file of filesFrom(formData, 'documents')) {
    const stored = await saveUpload(file, 'quotation');
    if (stored) documents.push(stored);
  }

  return {
    customerId: num(formData, 'customer_id'),
    locationRef: str(formData, 'showroom'),
    date: String(formData.get('date') ?? ''),
    validTillDate: String(formData.get('valid_till_date') ?? ''),
    notes: str(formData, 'notes'),
    shippingAddress: str(formData, 'shipping_address'),
    documents,
    refNo: str(formData, 'ref_no'),
    itemAmount: num(formData, 'item_amount'),
    totalQuantity: num(formData, 'total_quantity'),
    totalTax: String(formData.get('total_tax') ?? '0-0'),
    totalDiscountAmount: num(formData, 'total_discount_amount'),
    discountType: num(formData, 'discount_type', 1),
    totalDiscount: num(formData, 'total_discount'),
    totalAmount: num(formData, 'total_amount'),
    shippingCharge: num(formData, 'shipping_charge'),
    otherCharge: num(formData, 'other_charge'),
    lines: readLines(formData),
  };
}

function validate(input: QuotationInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.customerId) errors.customer_id = 'Please select a customer.';
  if (!input.date) errors.date = 'The date field is required.';
  if (!input.validTillDate) errors.valid_till_date = 'Enter the valid-until date.';
  if (input.lines.length === 0) errors.items = 'Add at least one product.';
  return Object.keys(errors).length ? errors : null;
}

export async function storeQuotation(
  _prev: QuotationFormState,
  formData: FormData,
): Promise<QuotationFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('quotation.store');
  const input = await readInput(formData);

  const fieldErrors = validate(input);
  if (fieldErrors) return { fieldErrors };

  let quotationId: number;
  try {
    quotationId = await createQuotation(input, user.id);

    // `if ($request->send_mail == 1) $this->send_mail_quotation(...)`
    if (formData.get('send_mail')) {
      await mailQuotation(quotationId, user.id);
    }

    await successLog(`Quotation created: ${quotationId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['quotation.index']);

  // `if ($request->preview_status == 1) return redirect()->route('quotation.edit', ...)`
  if (formData.get('preview_status')) {
    redirect(route('quotation.edit', { id: quotationId }));
  }

  redirect(route('quotation.show', { id: quotationId }));
}

/** `send_mail_quotation($id)` - mail the quotation and stamp its status. */
async function mailQuotation(quotationId: number, userId: number): Promise<void> {
  const record = await findQuotation(quotationId);
  const email = record?.customer?.email;
  if (!record || !email) {
    await errorLog(`Customer email doesn't exist for quotation ${quotationId}`, userId);
    return;
  }

  const sent = await sendQuotationMail({
    to: email,
    customerName: record.customer?.name ?? '',
    invoiceNo: record.quotation.invoiceNo ?? String(quotationId),
    quotationUrl: `${config.app.url}${route('quotation.order.print_view', { id: quotationId })}`,
  });

  if (sent) {
    await markQuotationMailed(quotationId);
    await successLog(`Mail sent to ${email} for quotation ${quotationId}`, userId);
  }
}

export async function updateQuotationAction(
  _prev: QuotationFormState,
  formData: FormData,
): Promise<QuotationFormState> {
  formData = actionFormData(_prev, formData);
  const id = Number(formData.get('id'));
  const user = await authorize('quotation.edit');
  const input = await readInput(formData);

  const fieldErrors = validate(input);
  if (fieldErrors) return { fieldErrors };

  try {
    await updateQuotation(id, input, user.id);
    await successLog(`Quotation updated: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['quotation.index']);
  redirect(route('quotation.show', { id }));
}

export async function deleteQuotationAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('quotation.delete');
  await deleteQuotation(id);
  await successLog(`Quotation deleted: ${id}`, user.id);
  revalidatePath(ROUTES['quotation.index']);
}

// Conversion goes through the pre-filled sale form, not a one-shot action -
// see the note in `sale/actions.ts`.
