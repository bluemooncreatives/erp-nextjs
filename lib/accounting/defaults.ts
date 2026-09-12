// ---------------------------------------------------------------------------
// Default posting accounts - port of app/Traits/Accounts.php.
//
// Every one of these resolved a ChartAccount by its seeded `code`. They are
// looked up on demand and memoised per request, because the PHP trait hit the
// database on each call.
// ---------------------------------------------------------------------------

import 'server-only';
import { cache } from 'react';
import { MorphType } from '@/lib/db/morph';
import {
  AccountCode,
  findAccountByCode,
  findContactAccount,
  type ChartAccountRow,
} from './accounts';

class MissingAccountError extends Error {
  constructor(code: string) {
    super(
      `Chart of accounts is missing the account with code "${code}". ` +
        'The PHP installer seeds it; restore it before posting.',
    );
    this.name = 'MissingAccountError';
  }
}

const byCode = cache(async (code: string): Promise<ChartAccountRow> => {
  const row = await findAccountByCode(code);
  if (!row) throw new MissingAccountError(code);
  return row;
});

/** `defaultSalesAccount()` - code 04-15 */
export const defaultSalesAccountId = async () => (await byCode(AccountCode.Sales)).id;

/** `defaultSalesReturnAccount()` - code 03-23 (the PHP returned the model) */
export const defaultSalesReturnAccount = () => byCode(AccountCode.SalesReturn);

/** `defaultProductTaxAccount()` - code 02-12-13 */
export const defaultProductTaxAccountId = async () =>
  (await byCode(AccountCode.ProductTax)).id;

/** `shippingOrOthersChargeIncome()` - code 04-16-28 */
export const shippingOrOtherChargeIncomeId = async () =>
  (await byCode(AccountCode.ShippingIncome)).id;

/** `shippingOrOthersChargeExpense()` / `defaultOtherPurchaseTaxAccount()` - 01-27 */
export const shippingOrOtherChargeExpenseId = async () =>
  (await byCode(AccountCode.ShippingExpense)).id;

export const defaultOtherPurchaseTaxAccountId = shippingOrOtherChargeExpenseId;

/** `defaultPurchaseAccount()` - code 01-07 */
export const defaultPurchaseAccountId = async () => (await byCode(AccountCode.Purchase)).id;

/** `defaultPurchaseReturnAccount()` - code 04-24 */
export const defaultPurchaseReturnAccount = () => byCode(AccountCode.PurchaseReturn);

/** `defaultCostofGoodsSoldAccount()` - code 03-19 */
export const defaultCostOfGoodsSoldAccountId = async () =>
  (await byCode(AccountCode.CostOfGoodsSold)).id;

/** `defaultWalkInCustomerAccount()` - code 01-05-25 */
export const defaultWalkInCustomerAccount = () => byCode(AccountCode.WalkInCustomer);

/** `defaultRetailEarningProfitAccount()` - code 02-14 */
export const retainedEarningsAccountId = async () =>
  (await byCode(AccountCode.RetainedEarnings)).id;

/**
 * `othersTaxAccountByTaxId($id)` - a tax can nominate its own account through
 * `Tax::account()`, a morphOne on `chart_accounts` keyed by `contactable_*`.
 * With no account of its own, the default product-tax account is used.
 */
export async function taxAccountId(taxId: number | null | undefined): Promise<number> {
  if (!taxId) return defaultProductTaxAccountId();

  const account = await findContactAccount(taxId, MorphType.Tax);
  return account?.id ?? (await defaultProductTaxAccountId());
}

/** `GetAccountId($contactable_id, $contactable_type)` */
export async function contactAccountId(
  contactableId: number,
  contactableType: string,
): Promise<number | null> {
  const account = await findContactAccount(contactableId, contactableType);
  return account?.id ?? null;
}
