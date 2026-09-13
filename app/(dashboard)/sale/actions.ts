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
  approveSale,
  approveSaleReturn,
  createSale,
  updateSale,
  deleteSale,
  markSaleMailed,
  recordSalePayments,
  recordSaleReturn,
  saveShipping,
} from '@/lib/sale/repository';
import { saveUpload, fileFrom } from '@/lib/uploads';
import { findSale } from '@/lib/sale/queries';
import { sendSaleMail } from '@/lib/mail';
import { notifySale } from '@/lib/notifications/documents';
import { isEnabled } from '@/lib/business-settings';
import { config } from '@/lib/config';
import { actionFormData } from '@/lib/forms';
import { readSaleInput, readPayments, validate, str, numList } from '@/lib/sale/input';

export type SaleFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

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

    await notifySaleEvent(saleId, 'created', user.name);

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

/** `sendNotification($sale, ...)` - the sale reminders the controller raised. */
async function notifySaleEvent(
  saleId: number,
  event: 'created' | 'updated' | 'destroyed' | 'approved',
  actorName: string,
): Promise<void> {
  const record = await findSale(saleId);
  if (!record) return;

  await notifySale(
    {
      id: record.sale.id,
      invoiceNo: record.sale.invoiceNo,
      payableAmount: record.sale.payableAmount,
      customerId: record.sale.customerId,
      agentUserId: record.sale.agentUserId,
    },
    event,
    actorName,
  );
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
    await notifySaleEvent(saleId, 'updated', user.name);
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
    await notifySaleEvent(saleId, 'approved', user.name);
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
    // The PHP read the sale and notified before deleting it.
    await notifySaleEvent(saleId, 'destroyed', user.name);
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

// `acceptOrder()` - the customer confirming delivery - is `receiveSaleOrder`
// on the Sale On Condition screen, which also records who received it and the
// delivery note. The duplicate that used to sit here was wired to nothing.

// --- Quotation conversion --------------------------------------------------

// Converting a quotation opens the sale form pre-filled from it, at
// `/quotation/quotation-sale-convert/[id]`, so the totals can be adjusted
// before saving rather than written unseen. The one-shot action that used to
// sit here was wired to nothing.
