// ---------------------------------------------------------------------------
// Accounting periods - Modules/Account/Entities/TimePeriodAccount.php
//
// `TimePeriodAccount::where('is_closed', 0)->latest()->first()` is the open
// financial year, used by every 'year' period filter and by the reports.
// ---------------------------------------------------------------------------

import 'server-only';
import { cache } from 'react';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { timePeriodAccounts } from '@/lib/db/schema';

export const openAccountingPeriod = cache(async () => {
  const [row] = await db
    .select()
    .from(timePeriodAccounts)
    .where(eq(timePeriodAccounts.isClosed, 0))
    .orderBy(desc(timePeriodAccounts.id))
    .limit(1);
  return row ?? null;
});

export async function allAccountingPeriods() {
  return db.select().from(timePeriodAccounts).orderBy(desc(timePeriodAccounts.startDate));
}

export async function findAccountingPeriod(id: number) {
  const [row] = await db
    .select()
    .from(timePeriodAccounts)
    .where(eq(timePeriodAccounts.id, id))
    .limit(1);
  return row ?? null;
}
