// Seeds a scratch database with enough data for every screen to show rows.
//
//   DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root DB_PASSWORD= \
//   DB_DATABASE=software_erp node scripts/seed-demo.mjs
//
// Everything is created THROUGH the ported repositories, so the seed doubles as
// a write-path exercise: products, contacts, a received purchase order, an
// approved sale with a payment, vouchers, and a stock transfer.
//
// It WRITES. Never point it at production.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Module from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = process.cwd();

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'server-only') return require.resolve('./_server-only-stub.cjs');
  if (request.startsWith('@/')) {
    const target = path.join(root, request.slice(2));
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`]) {
      try {
        return originalResolve.call(this, candidate, ...rest);
      } catch {
        // next candidate
      }
    }
  }
  return originalResolve.call(this, request, ...rest);
};

for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = function (module, filename) {
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

const { db, pool } = require('@/lib/db/client');
const schema = require('@/lib/db/schema');
const { eq, and } = require('drizzle-orm');
const products = require('@/lib/product/products');
const contacts = require('@/lib/contact/repository');
const purchases = require('@/lib/purchase/repository');
const sales = require('@/lib/sale/repository');
const vouchers = require('@/lib/accounting/vouchers');
const journal = require('@/lib/accounting/journal');
const transfers = require('@/lib/inventory/transfers');
const accounts = require('@/lib/accounting/accounts');
const expenses = require('@/lib/accounting/expenses');
const income = require('@/lib/accounting/income');
const quotations = require('@/lib/quotation/repository');

const today = new Date().toISOString().slice(0, 10);
const stamp = Date.now().toString().slice(-6);
const log = (message) => console.log(`  ${message}`);

const [branch] = await db.select().from(schema.showRooms).limit(1);
if (!branch) throw new Error('The database has no branch to seed against.');
const locationRef = `showroom-${branch.id}`;

// --- Catalogue -------------------------------------------------------------

const productIds = [];
for (const [index, name] of ['Seed Widget', 'Seed Gadget', 'Seed Service'].entries()) {
  const id = await products.createProduct(
    {
      productName: `${name} ${stamp}`,
      productType: name.endsWith('Service') ? 'Service' : 'Single',
      productSkuCode: `SEED-${stamp}-${index}`,
      purchasePrice: 100 + index * 10,
      sellingPrice: 150 + index * 10,
      minSellingPrice: 120 + index * 10,
      hourlyRate: 90,
      tax: 5,
      taxType: 'percent',
      alertQuantity: '5',
      barcodeType: 'C39',
      manageStock: 1,
    },
    1,
  );
  productIds.push(id);
}
log(`products: ${productIds.join(', ')}`);

const skus = await db
  .select()
  .from(schema.productSku)
  .where(eq(schema.productSku.productId, productIds[0]));
const [firstSku] = skus;

const secondSkus = await db
  .select()
  .from(schema.productSku)
  .where(eq(schema.productSku.productId, productIds[1]));

const comboId = await products.createComboProduct(
  {
    name: `Seed Combo ${stamp}`,
    showroomId: branch.id,
    barcodeType: 'C39',
    price: 400,
    totalPurchasePrice: 210,
    totalRegularPrice: 310,
    minSellingPrice: 260,
    description: 'Seeded combo',
  },
  [
    { productSkuId: firstSku.id, quantity: 1 },
    { productSkuId: secondSkus[0].id, quantity: 2 },
  ],
  1,
);
log(`combo: ${comboId}`);

// --- Contacts --------------------------------------------------------------

const supplierId = await contacts.createContact(
  {
    contactType: 'Supplier',
    name: `Seed Supplier ${stamp}`,
    openingBalance: '500',
    payTerm: '15',
    payTermCondition: 'Days',
    mobile: '0170000000',
    address: 'Seed Street',
  },
  1,
);

const customerId = await contacts.createContact(
  {
    contactType: 'Customer',
    name: `Seed Customer ${stamp}`,
    openingBalance: '0',
    payTermCondition: '',
    mobile: '0180000000',
    address: 'Seed Avenue',
  },
  1,
);
// A customer who can sign in, so the customer-portal screens (/my-details,
// /invoice, /profile, /return, /transaction, /product/view) have a user whose
// `contact_id` resolves. They render 404 for staff, exactly as `findOrFail`
// did in Laravel.
await db
  .update(schema.generalSettings)
  .set({ contactLogin: 1 })
  .where(eq(schema.generalSettings.id, 1));

const portalEmail = `seed.customer.${stamp}@example.com`;
const portalCustomerId = await contacts.createContact(
  {
    contactType: 'Customer',
    name: `Seed Portal Customer ${stamp}`,
    openingBalance: '0',
    payTermCondition: '',
    email: portalEmail,
    password: 'password',
    mobile: '0190000000',
    address: 'Seed Portal Road',
  },
  1,
);

const [portalUser] = await db
  .select({ id: schema.users.id })
  .from(schema.users)
  .where(eq(schema.users.contactId, String(portalCustomerId)))
  .limit(1);

log(`contacts: supplier ${supplierId}, customer ${customerId}`);
log(`portal customer: contact ${portalCustomerId}, user ${portalUser?.id ?? 'none'} (${portalEmail} / password)`);

// --- Purchase, received into stock ----------------------------------------

const purchaseLines = [
  { productSkuId: firstSku.id, price: 100, sellingPrice: 150, quantity: 10, tax: 0, discount: 0 },
  {
    productSkuId: secondSkus[0].id,
    price: 110,
    sellingPrice: 160,
    quantity: 10,
    tax: 0,
    discount: 0,
  },
];
const itemAmount = purchaseLines.reduce((sum, l) => sum + l.price * l.quantity, 0);

const purchaseId = await purchases.createPurchaseOrder(
  {
    supplierId,
    locationRef,
    date: today,
    refNo: `SEED-PO-${stamp}`,
    itemAmount,
    totalQuantity: purchaseLines.reduce((sum, l) => sum + l.quantity, 0),
    totalDiscountAmount: 0,
    totalDiscount: 0,
    discountType: 2,
    totalAmount: itemAmount,
    totalTax: '0-0',
    shippingCharge: 0,
    otherCharge: 0,
    lines: purchaseLines,
  },
  1,
);
await purchases.approvePurchaseOrder(purchaseId, 1);
await purchases.receivePurchaseIntoStock(
  purchaseId,
  purchaseLines.map((line) => ({ productSkuId: line.productSkuId, quantity: line.quantity })),
  1,
);
log(`purchase order: ${purchaseId} (approved and received)`);

// --- Sale, approved and part-paid -----------------------------------------

const saleLines = [
  {
    productableId: firstSku.id,
    productSkuId: firstSku.id,
    price: 150,
    quantity: 2,
    tax: 0,
    discount: 0,
  },
];
const saleAmount = saleLines.reduce((sum, l) => sum + l.price * l.quantity, 0);

const saleId = await sales.createSale(
  {
    customerRef: `customer-${customerId}`,
    locationRef,
    date: today,
    refNo: `SEED-SO-${stamp}`,
    itemAmount: saleAmount,
    totalQuantity: saleLines.reduce((sum, l) => sum + l.quantity, 0),
    totalTax: '0-0',
    shippingCharge: 0,
    otherCharge: 0,
    totalDiscountAmount: 0,
    discountType: 2,
    totalDiscount: 0,
    totalAmount: saleAmount,
    saleType: 1,
    lines: saleLines,
  },
  1,
);

if (saleId === sales.INSUFFICIENT_STOCK) {
  throw new Error('sale rejected: not enough stock after receiving the purchase');
}

await sales.approveSale(saleId, 1);
await sales.recordSalePayments(
  saleId,
  [{ paymentMethod: 'cash', amount: saleAmount / 2, accountId: null }],
  1,
);
log(`sale: ${saleId} (approved, half paid)`);

// A second, conditional sale so that screen has a row too.
const conditionalId = await sales.createSale(
  {
    customerRef: `customer-${customerId}`,
    locationRef,
    date: today,
    refNo: `SEED-COND-${stamp}`,
    itemAmount: 150,
    totalQuantity: 1,
    totalTax: '0-0',
    shippingCharge: 0,
    otherCharge: 0,
    totalDiscountAmount: 0,
    discountType: 2,
    totalDiscount: 0,
    totalAmount: 150,
    saleType: 0,
    lines: [
      {
        productableId: firstSku.id,
        productSkuId: firstSku.id,
        price: 150,
        quantity: 1,
        tax: 0,
        discount: 0,
      },
    ],
  },
  1,
);
log(`conditional sale: ${conditionalId}`);

// A sale the portal customer owns, so `/my-details` lists an invoice and
// `/my-details/sale/payment/{id}` has a row that belongs to the signed-in
// contact rather than answering 404.
const portalSaleId = await sales.createSale(
  {
    customerRef: `customer-${portalCustomerId}`,
    locationRef,
    date: today,
    refNo: `SEED-PORTAL-${stamp}`,
    itemAmount: 150,
    totalQuantity: 1,
    totalTax: '0-0',
    shippingCharge: 0,
    otherCharge: 0,
    totalDiscountAmount: 0,
    discountType: 2,
    totalDiscount: 0,
    totalAmount: 150,
    saleType: 1,
    lines: [
      { productableId: firstSku.id, productSkuId: firstSku.id, price: 150, quantity: 1, tax: 0, discount: 0 },
    ],
  },
  1,
);
if (portalSaleId === sales.INSUFFICIENT_STOCK) {
  throw new Error('portal sale rejected: not enough stock');
}
await sales.approveSale(portalSaleId, 1);
log(`portal sale: ${portalSaleId}`);

// --- Vouchers --------------------------------------------------------------

const postable = await db
  .select()
  .from(schema.chartAccounts)
  .where(and(eq(schema.chartAccounts.isGroup, 0), eq(schema.chartAccounts.status, 1)))
  .limit(4);

const receiptId = await vouchers.createVoucher({
  voucherType: 'CV',
  amount: 250,
  date: today,
  paymentType: 'voucher_recieve',
  creditAccountId: postable[0].id,
  debitAccountId: postable[1].id,
  narration: 'Seeded receipt',
  isApprove: 1,
  createdBy: 1,
});

const paymentId = await vouchers.createVoucher({
  voucherType: 'BV',
  amount: 175,
  date: today,
  paymentType: 'voucher_payment',
  creditAccountId: postable[1].id,
  debitAccountId: postable[2].id,
  narration: 'Seeded payment',
  bankName: 'Seed Bank',
  bankBranch: 'Main',
  chequeNo: `CHQ-${stamp}`,
  chequeDate: today,
  isApprove: 0,
  createdBy: 1,
});

const journalId = await journal.createJournalVoucher({
  voucherType: 'JV',
  amount: 90,
  date: today,
  accountType: 'debit',
  paymentType: 'journal_voucher',
  accountId: postable[0].id,
  mainAmount: 90,
  narration: 'Seeded journal',
  subAccountId: [postable[3].id],
  subAmount: [90],
  subNarration: ['Seeded journal line'],
  isApprove: 1,
  createdBy: 1,
});

const contraId = await journal.createJournalVoucher({
  voucherType: 'CTV',
  amount: 60,
  date: today,
  accountType: 'debit',
  paymentType: 'contra_voucher',
  accountId: postable[1].id,
  mainAmount: 60,
  narration: 'Seeded contra',
  subAccountId: [postable[2].id],
  subAmount: [60],
  subNarration: ['Seeded contra line'],
  isApprove: 1,
  createdBy: 1,
});
log(`vouchers: receipt ${receiptId}, payment ${paymentId}, journal ${journalId}, contra ${contraId}`);

// --- Expense, income, bank account and quotation ---------------------------
//
// Four screens the sweeps could not reach before: with these tables empty,
// `/account/expenses/1/edit` and friends answered 404 for a row that simply
// did not exist, which the sweep counts as an acceptable response.

const expenseId = await expenses.createExpense({
  voucherType: 'BV',
  amount: 40,
  date: today,
  narration: 'Seeded expense',
  paymentType: 'cash_voucher',
  isApprove: 1,
  accountType: 'credit',
  accountId: postable[0].id,
  mainAmount: 40,
  subAccountId: [postable[2].id],
  subAmount: [40],
  subNarration: ['Seeded expense line'],
  showroomId: branch.id,
  createdBy: 1,
});

const [incomeAccount] = await income.incomeAccounts();

const incomeId = await income.createIncome({
  accountId: (incomeAccount ?? postable[0]).id,
  accountType: 'debit',
  amount: 55,
  date: today,
  narration: 'Seeded income',
  note: 'Seeded income line',
  isApprove: 1,
  showroomId: branch.id,
  createdBy: 1,
});

const bankAccountId = await expenses.createBankAccount(
  {
    bankName: `Seed Bank ${stamp}`,
    branchName: 'Seed Branch',
    accountName: 'Seed Account',
    accountNo: `SEED-${stamp}`,
    description: 'Seeded bank account',
  },
  1,
);

const quotationId = await quotations.createQuotation(
  {
    customerId,
    locationRef,
    date: today,
    validTillDate: today,
    notes: 'Seeded quotation',
    refNo: `SEED-QT-${stamp}`,
    itemAmount: 300,
    totalQuantity: 2,
    totalTax: '0-0',
    totalDiscountAmount: 0,
    discountType: 0,
    totalDiscount: 0,
    totalAmount: 300,
    shippingCharge: 0,
    otherCharge: 0,
    lines: [
      {
        productableId: firstSku.id,
        productSkuId: firstSku.id,
        price: 150,
        quantity: 2,
        tax: 0,
        discount: 0,
      },
    ],
  },
  1,
);

log(`expense ${expenseId}, income ${incomeId}, bank account ${bankAccountId}, quotation ${quotationId}`);

// --- Stock transfer and adjustment ----------------------------------------

let [otherBranch] = await db
  .select()
  .from(schema.showRooms)
  .where(eq(schema.showRooms.status, 1))
  .limit(2);
const branches = await db.select().from(schema.showRooms).limit(2);
otherBranch = branches.find((b) => b.id !== branch.id) ?? null;

if (otherBranch) {
  const transferId = await transfers.createStockTransfer(
    {
      fromRef: locationRef,
      toRef: `showroom-${otherBranch.id}`,
      date: today,
      notes: 'Seeded transfer',
      lines: [{ productSkuId: firstSku.id, price: 100, quantity: 2 }],
    },
    1,
  );
  await transfers.setTransferStatus(transferId, 1);
  await transfers.receiveStockTransfer(transferId, 1);
  log(`stock transfer: ${transferId} (approved and received)`);
}

const adjustmentId = await transfers.createStockAdjustment(
  {
    locationRef,
    date: today,
    refNo: `SEED-ADJ-${stamp}`,
    recoveryAmount: 0,
    lines: [{ productSkuId: firstSku.id, quantity: 1 }],
  },
  1,
);
log(`stock adjustment: ${adjustmentId}`);

const balance = await accounts.accountBalance(postable[0]);
log(`balance of ${postable[0].name}: ${balance}`);

console.log('seed complete');
await pool.end();
