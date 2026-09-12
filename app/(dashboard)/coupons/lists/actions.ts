'use server';

// `CouponController@store` with the rules from `CouponFormRequest`: a unique
// code, a status, and an end date after the start date.

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { ROUTES } from '@/lib/routes';
import { couponCodeTaken, createCoupon } from '@/lib/product/coupons';

export type CouponFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export async function storeCoupon(
  _previous: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  const text = (key: string) => String(formData.get(key) ?? '').trim();

  const code = text('code');
  const startDate = text('start_date');
  const endDate = text('end_date');
  const status = Number(formData.get('status') ?? 1);
  const discountType = text('discount_type') || '1';

  const fieldErrors: Record<string, string> = {};
  if (!code) fieldErrors.code = 'The code field is required.';
  else if (await couponCodeTaken(code)) fieldErrors.code = 'The code has already been taken.';
  if (!startDate) fieldErrors.start_date = 'The start date field is required.';
  if (!endDate) fieldErrors.end_date = 'The end date field is required.';
  else if (startDate && endDate <= startDate) {
    fieldErrors.end_date = 'The end date must be a date after start date.';
  }
  if (![1, 2].includes(status)) fieldErrors.status = 'The status field is required.';
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const user = await authorize('coupon.store');

  try {
    await createCoupon(
      { code, cause: text('cause') || null, discountType, status, startDate, endDate },
      user.id,
    );
    await successLog(`New Coupon - (${code}) has been created.`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['coupon.index']);
  return { success: 'Coupon has been added Successfully' };
}
