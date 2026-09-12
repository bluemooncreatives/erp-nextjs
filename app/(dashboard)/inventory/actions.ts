'use server';

// Inventory server actions - ports of StockTransferController and
// StockAdjustmentController.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import { filesFrom, saveUpload } from '@/lib/uploads';
import {
  INSUFFICIENT_STOCK,
  applyStockAdjustment,
  createStockAdjustment,
  createStockTransfer,
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

function numList(formData: FormData, key: string): number[] {
  return formData.getAll(key).map((v) => Number(v)).filter(Number.isFinite);
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const value = raw == null ? '' : String(raw).trim();
  return value === '' ? null : value;
}

// --- Transfers -------------------------------------------------------------

export async function storeStockTransfer(
  _prev: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const user = await authorize('stock-transfer.store');

  const productIds = numList(formData, 'product_id');
  const prices = numList(formData, 'product_price');
  const quantities = numList(formData, 'quantity');

  const fieldErrors: Record<string, string> = {};
  if (!formData.get('from')) fieldErrors.from = 'Select the sending location.';
  if (!formData.get('to')) fieldErrors.to = 'Select the receiving location.';
  if (formData.get('from') === formData.get('to')) {
    fieldErrors.to = 'The sending and receiving locations must differ.';
  }
  if (!formData.get('date')) fieldErrors.date = 'The date field is required.';
  if (productIds.length === 0) fieldErrors.product_id = 'Add at least one product.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const documents: string[] = [];
  for (const file of filesFrom(formData, 'documents')) {
    const stored = await saveUpload(file, 'stock_transfer');
    if (stored) documents.push(stored);
  }

  try {
    const id = await createStockTransfer(
      {
        fromRef: String(formData.get('from') ?? ''),
        toRef: String(formData.get('to') ?? ''),
        date: String(formData.get('date') ?? ''),
        notes: str(formData, 'notes'),
        documents,
        lines: productIds.map((productSkuId, i) => ({
          productSkuId,
          price: prices[i] ?? 0,
          quantity: quantities[i] ?? 0,
        })),
      },
      user.id,
    );
    if (!id) return { error: 'Select Warehouse or Showroom' };
    await successLog(`Stock transfer created: ${id}`, user.id);
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
  const user = await authorize('stock_adjustment.store');

  const productIds = numList(formData, 'product_id');
  const quantities = numList(formData, 'product_quantity');

  const fieldErrors: Record<string, string> = {};
  if (!formData.get('warehouse_id')) {
    fieldErrors.warehouse_id = 'Select Warehouse or Showroom';
  }
  if (!formData.get('date')) fieldErrors.date = 'The date field is required.';
  if (productIds.length === 0) fieldErrors.product_id = 'Add at least one product.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const id = await createStockAdjustment(
      {
        locationRef: String(formData.get('warehouse_id') ?? ''),
        refNo: str(formData, 'ref_no'),
        recoveryAmount: Number(formData.get('recovery_amount') ?? 0),
        date: String(formData.get('date') ?? ''),
        reason: str(formData, 'notes'),
        lines: productIds.map((productSkuId, i) => ({
          productSkuId,
          quantity: quantities[i] ?? 0,
        })),
      },
      user.id,
    );
    if (!id) return { error: 'Select Warehouse or Showroom' };
    await successLog(`Stock adjustment created: ${id}`, user.id);
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
