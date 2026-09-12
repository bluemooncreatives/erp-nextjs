'use server';

// `SaleController@saleOrder` / `SaleRepository::acceptOrder()` - stamps who
// received the delivery and when on the sale's latest shipping row.

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { shippings } from '@/lib/db/schema';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import { latestShippingBySale } from '@/lib/sale/queries';
import { actionFormData } from '@/lib/forms';

export type ReceiveOrderState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export async function receiveSaleOrder(
  _previous: ReceiveOrderState,
  formData: FormData,
): Promise<ReceiveOrderState> {
  formData = actionFormData(_previous, formData);
  const saleId = Number(formData.get('id'));
  const name = String(formData.get('name') ?? '').trim();
  const date = String(formData.get('delivery_date') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'The received by field is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fieldErrors.delivery_date = 'Enter a valid delivery date.';
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const user = await authorize('sale.order.receive');

  const shipping = (await latestShippingBySale([saleId])).get(saleId);
  if (!shipping) return { error: 'This sale has no shipping record.' };

  try {
    await db
      .update(shippings)
      .set({ receivedBy: name, receivedDate: date, updatedAt: new Date() })
      .where(eq(shippings.id, shipping.id));
    await successLog(`Sale delivery recorded: ${saleId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['conditional.sale.index']);
  return { success: 'Sale Info has Been Updated' };
}
