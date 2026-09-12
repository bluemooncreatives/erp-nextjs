'use server';

// Inventory server actions - ports of StockTransferController and
// StockAdjustmentController.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import { filesFrom, saveUpload } from '@/lib/uploads';
import { transferInput } from '@/lib/inventory/transfer-input';
import { adjustmentInput } from '@/lib/inventory/adjustment-input';
import {
  INSUFFICIENT_STOCK,
  applyStockAdjustment,
  createStockAdjustment,
  updateStockAdjustment,
  createStockTransfer,
  updateStockTransfer,
  deleteStockAdjustment,
  deleteStockTransfer,
  receiveStockTransfer,
  sendStockTransfer,
  setTransferStatus,
} from '@/lib/inventory/transfers';

export type InventoryFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

// --- Transfers -------------------------------------------------------------

export async function storeStockTransfer(
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  return saveTransferForm(null, formData);
}

export async function updateTransferAction(_prev: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  await authorize('stock-transfer.edit');
  const id = Number(formData.get('id'));
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'Invalid transfer.' };
  return saveTransferForm(id, formData);
}

async function saveTransferForm(editId: number | null, formData: FormData): Promise<InventoryFormState> {
  const user = await authorize(editId == null ? 'stock-transfer.store' : 'stock-transfer.edit');
  const { data, fieldErrors } = transferInput(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  try {
    const documents: string[] = [];
    for (const file of filesFrom(formData, 'documents')) {
      const stored = await saveUpload(file, 'stock_transfer');
      if (stored) documents.push(stored);
    }
    data.documents = documents;
    const id = editId == null ? await createStockTransfer(data, user.id) : await updateStockTransfer(editId, data, user.id);
    if (!id) return { error: 'Select Warehouse or Showroom' };
    await successLog(`Stock transfer ${editId == null ? "created" : "updated"}: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['stock-transfer.index']);
  redirect(ROUTES['stock-transfer.index']);
}

export async function sendTransferAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('stock-transfer.sent');

  await sendStockTransfer(id);
  await successLog(`Stock transfer ${id} dispatched`, user.id);
  revalidatePath(ROUTES['stock-transfer.index']);
}

export async function receiveTransferAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('stock-transfer.receive');

  const result = await receiveStockTransfer(id, user.id);
  if (result === INSUFFICIENT_STOCK) {
    await errorLog(
      `Stock transfer ${id} could not be received - sender lacks stock`,
      user.id,
    );
  } else {
    await successLog(`Stock transfer ${id} received`, user.id);
  }

  revalidatePath(ROUTES['stock-transfer.index']);
}

export async function changeTransferStatusAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  await authorize('stock-transfer.status');
  await setTransferStatus(id, 1);
  revalidatePath(ROUTES['stock-transfer.index']);
}

export async function deleteTransferAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('stock-transfer.delete');
  await deleteStockTransfer(id);
  await successLog(`Stock transfer deleted: ${id}`, user.id);
  revalidatePath(ROUTES['stock-transfer.index']);
}

// --- Adjustments -----------------------------------------------------------

export async function storeStockAdjustment(
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  return saveAdjustmentForm(null, formData);
}

export async function updateAdjustmentAction(_prev: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const id = Number(formData.get('id'));
  await authorize('stock_adjustment.edit');
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'Invalid adjustment.' };
  return saveAdjustmentForm(id, formData);
}

async function saveAdjustmentForm(editId: number | null, formData: FormData): Promise<InventoryFormState> {
  const user = await authorize(editId == null ? 'stock_adjustment.store' : 'stock_adjustment.edit');
  const { data, fieldErrors } = adjustmentInput(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  try {
    const id = editId == null ? await createStockAdjustment(data, user.id) : await updateStockAdjustment(editId, data, user.id);
    if (!id) return { error: 'Select Warehouse or Showroom' };
    await successLog(`Stock adjustment ${editId == null ? "created" : "updated"}: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['stock_adjustment.index']);
  redirect(ROUTES['stock_adjustment.index']);
}

export async function approveAdjustmentAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('stock_adjustment.approve');

  try {
    await applyStockAdjustment(id, user.id);
    await successLog(`Stock adjustment applied: ${id}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['stock_adjustment.index']);
}

export async function deleteAdjustmentAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const user = await authorize('stock_adjustment.destroy');
  await deleteStockAdjustment(id);
  await successLog(`Stock adjustment deleted: ${id}`, user.id);
  revalidatePath(ROUTES['stock_adjustment.index']);
}
