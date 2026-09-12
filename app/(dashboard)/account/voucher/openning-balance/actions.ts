'use server';

// Opening balance actions - port of Modules/Account
// OpeningBalanceHistoryController.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { authorize } from '@/lib/auth/permissions';
import { errorLog, successLog } from '@/lib/activity-log';
import { db } from '@/lib/db/client';
import { timePeriodAccounts } from '@/lib/db/schema';
import {
  AccTypeAsset,
  AccTypeLiability,
  createOpeningBalance,
  openingBalanceExists,
  replaceOpeningBalances,
  closeAccountingPeriod,
} from '@/lib/accounting/opening-balance';
import { accountBalances } from '@/lib/accounting/reports';
import { AccountCode, accountIdByCode } from '@/lib/accounting/accounts';
import { toDateString, today } from '@/lib/php-date';
import { ROUTES } from '@/lib/routes';
import { actionFormData } from '@/lib/forms';

export type OpeningBalanceFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

/** `OpeningBalanceFormRequest` */
function validate(formData: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!formData.get('account_id')) errors.account_id = 'The account field is required.';
  if (!formData.get('amount')) errors.amount = 'The amount field is required.';
  if (!formData.get('type')) errors.type = 'The type field is required.';
  return errors;
}

/** `OpeningBalanceHistoryController@store` */
export async function storeOpeningBalance(
  _prev: OpeningBalanceFormState,
  formData: FormData,
): Promise<OpeningBalanceFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('openning_balance.store');

  const fieldErrors = validate(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const accountId = Number(formData.get('account_id'));

  // The controller refused a second opening balance for the same account.
  if (await openingBalanceExists(accountId)) {
    return { error: 'Openning balance already add for this account' };
  }

  try {
    await createOpeningBalance({
      accountId,
      amount: Number(formData.get('amount')) || 0,
      date: toDateString(String(formData.get('date') ?? '')) ?? today(),
      accType: String(formData.get('type')),
    });
    await successLog('Openning Balance Added.', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  revalidatePath(ROUTES['openning_balance.index']);
  return { success: 'Openning Balance Added Successfully' };
}

/** `OpeningBalanceHistoryController@update` */
export async function updateOpeningBalances(
  _prev: OpeningBalanceFormState,
  formData: FormData,
): Promise<OpeningBalanceFormState> {
  formData = actionFormData(_prev, formData);
  const user = await authorize('openning_balance.update');
  const id = Number(formData.get('id'));

  try {
    await replaceOpeningBalances(id, {
      date: String(formData.get('date') ?? ''),
      assetAccountId: formData.getAll('asset_account_id').map((v) => Number(v)),
      assetAmount: formData.getAll('asset_amount').map((v) => Number(v) || 0),
      liabilityAccountId: formData.getAll('liability_account_id').map((v) => Number(v)),
      liabilityAmount: formData.getAll('liability_amount').map((v) => Number(v) || 0),
    });
    await successLog('Openning Balance Updated.', user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
    return { error: 'Something Went Wrong' };
  }

  redirect(ROUTES['openning_balance.index']);
}

/**
 * `OpeningBalanceHistoryController@closeStatement`.
 *
 * Closing a period stamps its end date, opens the next one from the following
 * day, and carries every asset and liability balance forward as the new
 * period's default opening balances - plus the period's net profit against
 * Retained Earnings (`02-14`).
 */
export async function closeStatement(formData: FormData): Promise<void> {
  const user = await authorize('openning_balance.closeStatement');

  const periodId = Number(formData.get('timeInterval_id'));
  const closingDate = toDateString(String(formData.get('date') ?? '')) ?? today();

  const [period] = await db
    .select()
    .from(timePeriodAccounts)
    .where(eq(timePeriodAccounts.id, periodId))
    .limit(1);
  if (!period?.startDate) return;

  try {
    const balances = await accountBalances({ from: period.startDate, to: closingDate });
    const byCode = new Map(balances.map((b) => [b.code ?? '', b]));

    const costOfGoodsSold = byCode.get(AccountCode.CostOfGoodsSold)?.balance ?? 0;
    const totalSale = byCode.get(AccountCode.Sales)?.balance ?? 0;

    // Income and expense, minus the four accounts the profit is derived from.
    const incomeTotal = balances
      .filter(
        (b) =>
          Number(b.type) === 4 &&
          ![AccountCode.PurchaseReturn, AccountCode.Sales].includes(
            (b.code ?? '') as typeof AccountCode.Sales,
          ),
      )
      .reduce((sum, b) => sum + b.balance, 0);

    const expenseTotal = balances
      .filter(
        (b) =>
          Number(b.type) === 3 &&
          ![AccountCode.SalesReturn, AccountCode.CostOfGoodsSold].includes(
            (b.code ?? '') as typeof AccountCode.SalesReturn,
          ),
      )
      .reduce((sum, b) => sum + b.balance, 0);

    const netProfit = totalSale - costOfGoodsSold - expenseTotal + incomeTotal;

    // Stamp the end date and open the next period the day after.
    await db
      .update(timePeriodAccounts)
      .set({ endDate: closingDate, updatedAt: new Date() })
      .where(eq(timePeriodAccounts.id, periodId));

    const nextStart = new Date(`${closingDate}T00:00:00Z`);
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
    await db.insert(timePeriodAccounts).values({
      startDate: nextStart.toISOString().slice(0, 10),
      isClosed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const balance of balances) {
      const type = Number(balance.type);
      if (balance.balance <= 0 || (type !== 1 && type !== 2)) continue;

      await createOpeningBalance({
        accountId: balance.id,
        amount: balance.balance,
        date: closingDate,
        accType: type === 1 ? AccTypeAsset : AccTypeLiability,
        isDefault: 1,
      });
    }

    const retainedEarningsId = await accountIdByCode(AccountCode.RetainedEarnings);
    if (retainedEarningsId) {
      await createOpeningBalance({
        accountId: retainedEarningsId,
        amount: netProfit,
        date: closingDate,
        accType: AccTypeLiability,
        isDefault: 1,
      });
    }

    await closeAccountingPeriod(periodId);
    await successLog(`${period.startDate} Accounting Period Closed.`, user.id);
  } catch (error) {
    await errorLog(String(error), user.id);
  }

  revalidatePath(ROUTES['openning_balance.index']);
}
