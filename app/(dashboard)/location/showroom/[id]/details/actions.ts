'use server';

// `OpeningBalanceHistoryController@showroom_openning_balance_store` - the
// branch's opening balance, offset against the `02-09-11` control account.
//
// The controller passed a `time_period_id`, but `createForUser()` never stored
// it and `opening_balance_histories` has no such column, so it is not written
// here either.

import { revalidatePath } from 'next/cache';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { findContactAccount } from '@/lib/accounting/accounts';
import {
  createOpeningBalanceForContact,
  createOpeningBalanceHistory,
  openingBalanceControlAccountId,
} from '@/lib/accounting/opening-balance';
import { transaction as runInTransaction } from '@/lib/db/client';
import { MorphType } from '@/lib/db/morph';
import { today } from '@/lib/php-date';
import { route } from '@/lib/routes';

export type OpeningBalanceState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export async function storeShowroomOpeningBalance(
  _previous: OpeningBalanceState,
  formData: FormData,
): Promise<OpeningBalanceState> {
  const showroomId = Number(formData.get('showroom_id'));
  const amount = Number(formData.get('opening_balance'));
  const type = String(formData.get('type') ?? 'showroom').trim() || 'showroom';

  if (!Number.isFinite(amount) || amount <= 0) {
    return { fieldErrors: { opening_balance: 'Enter an amount greater than zero.' } };
  }

  const user = await authorize('showroom_openning_balance.store');

  const account = await findContactAccount(showroomId, MorphType.ShowRoom);
  if (!account) return { error: 'This branch has no ledger account.' };

  const controlAccountId = await openingBalanceControlAccountId();

  try {
    await runInTransaction(async (tx) => {
      await createOpeningBalanceForContact(
        {
          assetAccountId: account.id,
          assetAmount: amount,
          liabilityAccountId: controlAccountId,
          liabilityAmount: amount,
          date: today(),
        },
        tx,
      );
      await createOpeningBalanceHistory(
        { accountId: account.id, type, amount },
        tx,
      );
    });
    await successLog(`Openning Balance Added for showroom - ${showroomId}`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(route('showroom.show', { id: showroomId }));
  return { success: 'Openning Balance Added Successfully' };
}
