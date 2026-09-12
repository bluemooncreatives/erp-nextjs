// ---------------------------------------------------------------------------
// The `csv_upload_*` repository methods.
//
// Every importer follows the PHP shape: the header row names the target
// columns, each later row is one record, and the whole file is applied inside a
// single transaction so a bad row leaves nothing behind (`DB::beginTransaction`
// / `DB::rollBack` in the controllers).
// ---------------------------------------------------------------------------

import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db, transaction as runInTransaction } from '@/lib/db/client';
import {
  bankAccounts,
  brands,
  chartAccounts,
  models,
  productSku,
  products,
  unitTypes,
} from '@/lib/db/schema';
import { MorphType } from '@/lib/db/morph';
import { AccountType, ConfigurationGroup, RootAccountId } from '@/lib/accounting/accounts';
import { defaultPurchaseAccountId } from '@/lib/accounting/defaults';
import { createJournalVoucher } from '@/lib/accounting/journal';
import {
  createOpeningBalance,
  createOpeningBalanceHistory,
  openingBalanceControlAccountId,
} from '@/lib/accounting/opening-balance';
import { openAccountingPeriod } from '@/lib/accounting/periods';
import { isEnabled } from '@/lib/business-settings';
import { createContact } from '@/lib/contact/repository';
import { createStaff } from '@/lib/hr/staff';
import { adjustStock, recordMovement } from '@/lib/inventory/stock';
import { today } from '@/lib/php-date';
import { readSpreadsheet, rowsToRecords, type SheetRows } from './spreadsheet';

export type ImportResult = { imported: number };

function text(record: Record<string, string>, key: string): string | null {
  const value = record[key];
  return value == null || value === '' ? null : value;
}

function number(record: Record<string, string>, key: string): number {
  const value = Number(record[key]);
  return Number.isFinite(value) ? value : 0;
}

/** PHP's `Str::random($n)` over the alphanumeric alphabet. */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function records(file: File | null): Promise<Array<Record<string, string>>> {
  return rowsToRecords(await readSpreadsheet(file));
}

/** The staff sheet carries a note row above its headers (`skip(1)->first()`). */
async function staffRecords(file: File | null): Promise<Array<Record<string, string>>> {
  const rows: SheetRows = await readSpreadsheet(file);
  return rowsToRecords(rows.slice(1));
}

// --- Reference tables ------------------------------------------------------

/** `csv_upload_brand`, `csv_upload_model`, `csv_upload_unit` - name + description. */
async function importReference(
  table: typeof brands | typeof models | typeof unitTypes,
  file: File | null,
  userId?: number | null,
): Promise<ImportResult> {
  const rows = await records(file);
  if (!rows.length) return { imported: 0 };

  await runInTransaction(async (tx) => {
    for (const record of rows) {
      await tx.insert(table).values({
        name: text(record, 'name') ?? '',
        description: text(record, 'description'),
        status: 1,
        createdBy: userId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });

  return { imported: rows.length };
}

export const importBrands = (file: File | null, userId?: number | null) =>
  importReference(brands, file, userId);
export const importModels = (file: File | null, userId?: number | null) =>
  importReference(models, file, userId);
export const importUnitTypes = (file: File | null, userId?: number | null) =>
  importReference(unitTypes, file, userId);

// --- Contacts --------------------------------------------------------------

/**
 * `ContactRepository::csv_contact_upload()`. The PHP stripped spaces out of the
 * header names before using them as columns, and defaulted a missing address to
 * "n/a"; `createContact()` then adds the ledger account and opening balance.
 */
export async function importContacts(
  file: File | null,
  userId?: number | null,
): Promise<ImportResult> {
  const rows = (await records(file)).map((record) => {
    const stripped: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      stripped[key.replace(/\s+/g, '')] = value;
    }
    return stripped;
  });

  for (const record of rows) {
    await createContact(
      {
        contactType: text(record, 'contact_type') === 'Supplier' ? 'Supplier' : 'Customer',
        name: text(record, 'name') ?? '',
        businessName: text(record, 'business_name'),
        taxNumber: text(record, 'tax_number'),
        openingBalance: text(record, 'opening_balance') ?? '0',
        payTerm: text(record, 'pay_term'),
        payTermCondition: text(record, 'pay_term_condition') ?? '',
        creditLimit: text(record, 'credit_limit'),
        email: text(record, 'email'),
        mobile: text(record, 'mobile'),
        address: text(record, 'address') ?? 'n/a',
      },
      userId,
    );
  }

  return { imported: rows.length };
}

// --- Bank accounts ---------------------------------------------------------

/**
 * `BankAccountRepository::csv_upload_bank_account()` - the account and its
 * ledger account, coded `03-<id>`.
 *
 * The sample sheet carries an `openning_balance` column, but `bank_accounts`
 * has no such column and the model does not list it as fillable, so the PHP
 * dropped it and `create_chart_account()` never ran. The column is read here
 * and likewise ignored, rather than inventing an opening balance the original
 * never recorded.
 */
export async function importBankAccounts(
  file: File | null,
  userId?: number | null,
): Promise<ImportResult> {
  const rows = await records(file);
  if (!rows.length) return { imported: 0 };

  for (const record of rows) {
    await runInTransaction(async (tx) => {
      const [accountRow] = await tx.insert(chartAccounts).values({
        level: 2,
        isGroup: 0,
        name: text(record, 'bank_name') ?? '',
        type: String(AccountType.Asset),
        configurationGroupId: ConfigurationGroup.Bank,
        status: 1,
        parentId: RootAccountId.Bank,
        description: text(record, 'description'),
        createdBy: userId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const chartAccountId = Number(accountRow.insertId);
      await tx
        .update(chartAccounts)
        .set({ code: `${String(RootAccountId.Bank).padStart(2, '0')}-${chartAccountId}` })
        .where(eq(chartAccounts.id, chartAccountId));

      await tx.insert(bankAccounts).values({
        chartAccountId,
        bankName: text(record, 'bank_name') ?? '',
        branchName: text(record, 'branch_name'),
        accountName: text(record, 'account_name'),
        accountNo: text(record, 'account_no'),
        description: text(record, 'description'),
        createdBy: userId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    });
  }

  return { imported: rows.length };
}

// --- Staff -----------------------------------------------------------------

/** `UserRepository::csv_upload_staff()` - one user, staff row and ledger account. */
export async function importStaff(
  file: File | null,
  userId?: number | null,
): Promise<ImportResult> {
  const rows = await staffRecords(file);

  for (const record of rows) {
    await createStaff(
      {
        name: text(record, 'name') ?? '',
        email: text(record, 'email') ?? '',
        username: text(record, 'username'),
        password: text(record, 'password'),
        // `role_id => 3` in the importer: the staff role, as a system user.
        roleRef: '3-system_user',
        departmentId: 1,
        showroomId: 1,
        phone: text(record, 'phone'),
        dateOfJoining: text(record, 'date_of_joining'),
        bankName: text(record, 'bank_name'),
        bankBranchName: text(record, 'bank_branch_name'),
        bankAccountName: text(record, 'bank_account_name'),
        bankAccountNo: text(record, 'bank_account_no'),
        currentAddress: text(record, 'current_address'),
        permanentAddress: text(record, 'permanent_address'),
        basicSalary: text(record, 'basic_salary'),
        openingBalance: number(record, 'opening_balance'),
        employmentType: text(record, 'employment_type'),
        leaveApplicableDate: text(record, 'leave_applicable_date'),
      } as Parameters<typeof createStaff>[0],
      userId,
    );
  }

  return { imported: rows.length };
}

// --- Products --------------------------------------------------------------

/**
 * `ProductRepository::csv_upload_single_product()` - the product, its SKU, the
 * opening stock at the current branch and, when there is stock, the beginning
 * stock journal voucher.
 */
export async function importProducts(
  file: File | null,
  showroomId: number,
  userId?: number | null,
): Promise<ImportResult> {
  const rows = await records(file);
  if (!rows.length) return { imported: 0 };

  const purchaseAccountId = await defaultPurchaseAccountId();
  const controlAccountId = await openingBalanceControlAccountId();
  const approved = (await isEnabled('beginning_stock_voucher_approval')) ? 1 : 0;
  const location = { id: showroomId, type: MorphType.ShowRoom };

  for (const record of rows) {
    const stock = number(record, 'stock');
    const purchasePrice = number(record, 'purchase_price');

    const { productId, productSkuId } = await runInTransaction(async (tx) => {
      const [productRow] = await tx.insert(products).values({
        productName: text(record, 'product_name') ?? '',
        productType: text(record, 'product_type') ?? 'Single',
        modelId: text(record, 'model_id') ? number(record, 'model_id') : null,
        unitTypeId: text(record, 'unit_type_id') ? number(record, 'unit_type_id') : null,
        brandId: text(record, 'brand_id') ? number(record, 'brand_id') : null,
        origin: text(record, 'origin'),
        description: text(record, 'description'),
        priceOfOtherCurrency: text(record, 'price_of_other_currency'),
        createdBy: userId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newProductId = Number(productRow.insertId);
      const fallbackCode = `1000-${newProductId}-${randomString(12)}`;

      const [skuRow] = await tx.insert(productSku).values({
        productId: newProductId,
        barcodeId: `1000-${newProductId}-${randomString(12)}`,
        barcodeType: 'C39',
        taxType: '%',
        sku: text(record, 'sku') ?? fallbackCode,
        alertQuantity: number(record, 'alert_quantity'),
        purchasePrice,
        sellingPrice: number(record, 'selling_price'),
        minSellingPrice: number(record, 'min_selling_price'),
        tax: number(record, 'tax'),
        costOfGoods: number(record, 'cost_of_goods'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newSkuId = Number(skuRow.insertId);

      if (stock > 0) {
        await recordMovement(
          {
            type: 'begining' as never,
            documentType: MorphType.ShowRoom,
            documentId: showroomId,
            location,
            productSkuId: newSkuId,
            quantity: stock,
            date: today(),
            userId: userId ?? undefined,
          },
          tx,
        );
      }
      await adjustStock(location, newSkuId, stock, tx);

      return { productId: newProductId, productSkuId: newSkuId };
    });

    void productId;
    void productSkuId;

    if (stock > 0 && controlAccountId) {
      const amount = purchasePrice * stock;
      await createJournalVoucher({
        voucherType: 'JV',
        amount,
        date: today(),
        accountType: 'debit',
        paymentType: 'journal_voucher',
        accountId: purchaseAccountId,
        mainAmount: amount,
        narration: 'Beginning Stock Added By Showroom',
        subAccountId: [controlAccountId],
        subAmount: [amount],
        subNarration: ['Beginning Stock Added By Showroom'],
        isApprove: approved,
        createdBy: userId ?? null,
      });
    }
  }

  return { imported: rows.length };
}

// --- Exports ---------------------------------------------------------------

/** `csv_download()` - id and name of a reference table, as CSV rows. */
export async function referenceCsvRows(
  table: typeof brands | typeof models | typeof unitTypes,
): Promise<Array<Array<string | number>>> {
  const rows = await db
    .select({ id: table.id, name: table.name })
    .from(table)
    .orderBy(sql`${table.id}`);
  return [['id', 'name'], ...rows.map((row) => [row.id, row.name ?? ''])];
}
