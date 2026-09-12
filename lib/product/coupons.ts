// Coupons - port of Modules/Product/Repositories/CouponRepository.

import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { coupons, type CouponsRow } from '@/lib/db/schema';

export type CouponInput = {
  code: string;
  cause: string | null;
  discountType: string;
  status: number;
  startDate: string;
  endDate: string;
};

export async function listCoupons(): Promise<CouponsRow[]> {
  return db.select().from(coupons).orderBy(desc(coupons.id));
}

export async function couponCodeTaken(code: string): Promise<boolean> {
  const [row] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(eq(coupons.code, code))
    .limit(1);
  return Boolean(row);
}

export async function createCoupon(data: CouponInput, userId?: number | null): Promise<void> {
  await db.insert(coupons).values({
    ...data,
    createdBy: userId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
