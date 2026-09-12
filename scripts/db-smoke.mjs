// Runs the ported query layer against a real database.
//
//   DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root DB_PASSWORD= \
//   DB_DATABASE=software_erp node scripts/db-smoke.mjs
//
// Every entry below calls a repository or query function exactly as a page
// would. The point is not the values but the SQL: a query that MySQL rejects,
// or a column Drizzle maps wrongly, fails here. Exits non-zero on any failure.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Module from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();

// --- Resolve the app's own module graph -----------------------------------

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'server-only') return require.resolve('./_server-only-stub.cjs');
  if (request.startsWith('@/')) {
    const target = path.join(root, request.slice(2));
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')]) {
      try {
        return originalResolve.call(this, candidate, ...rest);
      } catch {
        // try the next candidate
      }
    }
  }
  return originalResolve.call(this, request, ...rest);
};

for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = function (module, filename) {
    const source = readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

// --- The checks ------------------------------------------------------------

const contactQueries = require('@/lib/contact/queries');
const contactRepo = require('@/lib/contact/repository');
const products = require('@/lib/product/products');
const productRepos = require('@/lib/product/repositories');
const saleQueries = require('@/lib/sale/queries');
const purchaseRepo = require('@/lib/purchase/repository');
const quotationRepo = require('@/lib/quotation/repository');
const accounts = require('@/lib/accounting/accounts');
const vouchers = require('@/lib/accounting/vouchers');
const journal = require('@/lib/accounting/journal');
const expenses = require('@/lib/accounting/expenses');
const reports = require('@/lib/accounting/reports');
const receipts = require('@/lib/accounting/receipts');
const cashbook = require('@/lib/accounting/cashbook');
const openingBalance = require('@/lib/accounting/opening-balance');
const periods = require('@/lib/accounting/periods');
const transfers = require('@/lib/inventory/transfers');
const hrStaff = require('@/lib/hr/staff');
const hrLeave = require('@/lib/hr/leave');
const hrLoans = require('@/lib/hr/loans');
const hrEvents = require('@/lib/hr/events');
const settings = require('@/lib/settings');
const settingRepo = require('@/lib/setting/repository');
const setupRepos = require('@/lib/setup/repositories');
const printers = require('@/lib/setup/printers');
const coupons = require('@/lib/product/coupons');
const dashboard = require('@/lib/dashboard/queries');
const reportQueries = require('@/lib/reports/queries');
const statements = require('@/lib/reports/statements');
const activityLog = require('@/lib/activity-log');
const backup = require('@/lib/backup');
const projectRepo = require('@/lib/project/repository');
const imports = require('@/lib/import/imports');
const { db } = require('@/lib/db/client');
const schema = require('@/lib/db/schema');

const firstIdOf = async (table) => {
  const [row] = await db.select().from(table).limit(1);
  return row?.id ?? 1;
};

const checks = [];
const check = (name, run) => checks.push({ name, run });

check('generalSetting', () => settings.generalSetting());
check('defaultCurrency', () => settings.defaultCurrency());
check('allBusinessSettings', () => require('@/lib/business-settings').allBusinessSettings());
check('allPaymentGateways', () => settingRepo.allPaymentGateways());
check('activeLanguages', () => settingRepo.activeLanguages());

check('listContacts', () => contactQueries.listContacts({ page: 1 }));
check('customerOptions', () => contactQueries.customerOptions());
check('supplierOptions', () => contactQueries.supplierOptions());
check('contactAccounts', async () => {
  const [contact] = await db.select().from(schema.contacts).limit(1);
  return contact ? contactQueries.contactAccounts(contact) : null;
});
check('contactStatement', async () => {
  const [contact] = await db.select().from(schema.contacts).limit(1);
  return contact ? contactQueries.contactStatement(contact) : null;
});
check('customerSaleProductItems', async () =>
  contactQueries.customerSaleProductItems(await firstIdOf(schema.contacts)),
);
check('supplierPurchaseProductItems', async () =>
  contactQueries.supplierPurchaseProductItems(await firstIdOf(schema.contacts)),
);
check('customerSaleHistory', async () =>
  contactRepo.customerSaleHistory(await firstIdOf(schema.contacts)),
);

check('listProductSkus', () => products.listProductSkus({ page: 1 }));
check('productsForPurchase', () => products.productsForPurchase());
check('productsWithStock', () => products.productsWithStock());
check('listComboProducts', () => products.listComboProducts());
check('comboItemCountMap', () => products.comboItemCountMap([1, 2, 3]));
check('findComboProduct', async () =>
  products.findComboProduct(await firstIdOf(schema.comboProducts)),
);
check('productDetail', async () => products.productDetail(await firstIdOf(schema.products)));
check('findProduct', async () => products.findProduct(await firstIdOf(schema.products)));
check('variantNameForSku', async () =>
  products.variantNameForSku(await firstIdOf(schema.productSku)),
);
check('productFormOptions', () => productRepos.productFormOptions());
check('allVariantsWithValues', () => productRepos.allVariantsWithValues());
check('brandRepository.list', () => productRepos.brandRepository.list({ page: 1 }));
check('taxRepository.list', () => productRepos.taxRepository.list({ page: 1 }));
check('listCoupons', () => coupons.listCoupons());
check('referenceCsvRows(brands)', () => imports.referenceCsvRows(schema.brands));

check('listSales', () => saleQueries.listSales({ page: 1 }));
check('listSales(conditional)', () =>
  saleQueries.listSales({ page: 1, type: saleQueries.SaleKind.Conditional }),
);
check('findSale', async () => saleQueries.findSale(await firstIdOf(schema.sales)));
check('latestShippingBySale', () => saleQueries.latestShippingBySale([1, 2, 3]));

check('listPurchaseOrders', () => purchaseRepo.listPurchaseOrders({ page: 1 }));
check('findPurchaseOrder', async () =>
  purchaseRepo.findPurchaseOrder(await firstIdOf(schema.purchaseOrders)),
);
check('stockAlertList', () => purchaseRepo.stockAlertList(null));
check('listQuotations', () => quotationRepo.listQuotations({ page: 1 }));

check('accountTree', () => accounts.accountTree());
check('accounts.accountBalances', async () => {
  const rows = await db.select().from(schema.chartAccounts).limit(20);
  return accounts.accountBalances(rows);
});
check('reports.accountBalances', () => reports.accountBalances({}));
check('accountTreeBalance', async () =>
  accounts.accountTreeBalance(await firstIdOf(schema.chartAccounts)),
);
check('receiveFromAccounts', () => accounts.receiveFromAccounts());
check('receiveByAccounts', () => accounts.receiveByAccounts());
check('paymentAccounts', () => accounts.paymentAccounts());
check('transactionalAccounts', () => journal.transactionalAccounts());
check('journalVouchers', () => journal.journalVouchers());
check('vouchersByPaymentType', () => vouchers.vouchersByPaymentType('voucher_recieve'));
check('voucherTransactions', async () =>
  vouchers.voucherTransactions(await firstIdOf(schema.vouchers)),
);
check('expenseAccounts', () => expenses.expenseAccounts());
check('listExpenses', () => expenses.listExpenses({ page: 1 }));
check('listIncomes', () => expenses.listIncomes({ page: 1 }));
check('listBankAccounts', () => expenses.listBankAccounts());
check('accountStatement', async () =>
  reports.accountStatement(await firstIdOf(schema.chartAccounts)),
);
check('receiptInvoiceOptions', async () =>
  receipts.receiptInvoiceOptions(await firstIdOf(schema.chartAccounts)),
);
check('cashbook', async () => {
  const showroomAccount = await cashbook.showroomAccountId(1);
  if (!showroomAccount) return null;
  const date = new Date().toISOString().slice(0, 10);
  return Promise.all([
    cashbook.cashbookCredits(showroomAccount, date),
    cashbook.cashbookDebits(showroomAccount, date),
    cashbook.cashbookOpening(showroomAccount, date),
  ]);
});
check('openingBalanceControlAccountId', () => openingBalance.openingBalanceControlAccountId());
check('openAccountingPeriod', () => periods.openAccountingPeriod());

check('stockList', () => transfers.stockList({ allBranches: true }));
check('listStockTransfers', () => transfers.listStockTransfers({ page: 1 }));
check('listStockAdjustments', () => transfers.listStockAdjustments({ page: 1 }));
check('skuStockAt', () => products.skuStockAt([1, 2, 3], 1));

check('listStaff', () => hrStaff.listStaff({ page: 1 }));
check('findStaff', async () => hrStaff.findStaff(await firstIdOf(schema.staffs)));
check('roleOptions', () => hrStaff.roleOptions());
check('listLeaveApplications', () => hrLeave.listLeaveApplications({ page: 1 }));
check('leaveBalance', async () => hrLeave.leaveBalance(await firstIdOf(schema.users)));
check('listLeaveDefines', () => hrLeave.listLeaveDefines());
check('listHolidays', () => hrLeave.listHolidays());
check('listPayrolls', () => hrLeave.listPayrolls({ page: 1 }));
check('staffPayrolls', async () => hrLeave.staffPayrolls(await firstIdOf(schema.staffs)));
check('staffLoans', async () => hrLoans.staffLoans(await firstIdOf(schema.users)));
check('listEvents', () => hrEvents.listEvents());
check('listToDos', () => hrEvents.listToDos());

check('locationOptions', () => setupRepos.locationOptions());
check('showRoomRepository.list', () => setupRepos.showRoomRepository.list({ page: 1 }));
check('countryRepository.list', () => setupRepos.countryRepository.list({ page: 1 }));
check('listPrinters', () => printers.listPrinters());

check('dashboard.paymentAccountOptions', () => dashboard.paymentAccountOptions());
check('activityLog.logActivityLists', () => activityLog.logActivityLists(10));
check('backup.listBackups', () => backup.listBackups());
check('project.userWorkspaces', async () => projectRepo.userWorkspaces(await firstIdOf(schema.users)));

check('salesReport', () => reportQueries.salesReport({}));
check('salesReturnReport', () => reportQueries.salesReturnReport({}));
check('productSalesReport', () => reportQueries.productSalesReport({}));
check('purchaseReport', () => reportQueries.purchaseReport({}));
check('productPurchaseReport', () => reportQueries.productPurchaseReport({}));
check('purchaseReturnReport', () => reportQueries.purchaseReturnReport({}));
check('customerReport', () => reportQueries.customerReport({}));
check('supplierReport', () => reportQueries.supplierReport({}));
check('serialNumberReport', () => reportQueries.serialNumberReport({}));
check('saleHistory', () => reportQueries.saleHistory({}));
check('purchaseHistory', () => reportQueries.purchaseHistory({}));
check('incomeByCustomer', () => reportQueries.incomeByCustomer({}));
check('expenseBySupplier', () => reportQueries.expenseBySupplier({}));
check('salesTaxReport', () => reportQueries.salesTaxReport({}));
check('customerBillReport', () => reportQueries.customerBillReport({}));
check('supplierBillReport', () => reportQueries.supplierBillReport({}));

check('reportPeriods', () => statements.reportPeriods());
check('ledgerAccounts', () => statements.ledgerAccounts());
check('showroomAccountIds', () => statements.showroomAccountIds());
check('dailyStatement', () => statements.dailyStatement(new Date().toISOString().slice(0, 10)));
check('incomeStatement', async () => {
  const periodsList = await statements.reportPeriods();
  return periodsList.length ? statements.incomeStatement(periodsList[0].id) : null;
});
check('balanceStatement', async () => {
  const periodsList = await statements.reportPeriods();
  return periodsList.length ? statements.balanceStatement(periodsList[0].id) : null;
});
check('cashFlowRows', async () => {
  const periodsList = await statements.reportPeriods();
  const range = periodsList.length ? await statements.periodRange(periodsList[0].id) : null;
  return range ? statements.cashFlowRows(range) : null;
});

const failures = [];
let passed = 0;

for (const { name, run } of checks) {
  try {
    await run();
    passed++;
  } catch (error) {
    failures.push({ name, error: String(error?.message ?? error).split('\n')[0] });
  }
}

console.log(`ran ${checks.length} queries: ${passed} ok, ${failures.length} failed`);
for (const failure of failures) console.log(`  FAIL ${failure.name}: ${failure.error}`);

const { pool } = require('@/lib/db/client');
await pool.end();
process.exit(failures.length ? 1 : 0);
