// Write-path checks against a REAL database.
//
//   DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root DB_PASSWORD= \
//   DB_DATABASE=software_erp node scripts/db-writes.mjs
//
// These exercise the ported repositories where the PHP did the most work -
// voucher posting and re-posting, stock movement on approval and receipt, sale
// payments, and contact creation - and assert the rows that come back.
//
// It WRITES, so point it at a scratch copy of the schema, never at production.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
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
const { eq, and, sql, desc } = require('drizzle-orm');
const vouchers = require('@/lib/accounting/vouchers');
const journal = require('@/lib/accounting/journal');
const accounts = require('@/lib/accounting/accounts');
const transfers = require('@/lib/inventory/transfers');
const saleRepo = require('@/lib/sale/repository');
const contactRepo = require('@/lib/contact/repository');
const imports = require('@/lib/import/imports');
const { MorphType } = require('@/lib/db/morph');

const today = new Date().toISOString().slice(0, 10);
const results = [];

async function scenario(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.message ?? error).split('\n')[0] });
  }
}

/** Two postable accounts to move money between. */
async function twoAccounts() {
  const rows = await db
    .select()
    .from(schema.chartAccounts)
    .where(and(eq(schema.chartAccounts.isGroup, 0), eq(schema.chartAccounts.status, 1)))
    .limit(2);
  assert.equal(rows.length, 2, 'need two postable accounts');
  return rows;
}

const legsOf = (voucherId) =>
  db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.voucherableId, voucherId),
        eq(schema.transactions.voucherableType, MorphType.Voucher),
      ),
    )
    .orderBy(schema.transactions.id);

await scenario('receipt voucher posts one Dr and one Cr leg for the amount', async () => {
  const [from, to] = await twoAccounts();
  const id = await vouchers.createVoucher({
    voucherType: 'CV',
    amount: 125.5,
    date: today,
    paymentType: 'voucher_recieve',
    creditAccountId: from.id,
    debitAccountId: to.id,
    narration: 'db-writes receipt',
    isApprove: 1,
    createdBy: 1,
  });

  const legs = await legsOf(id);
  assert.equal(legs.length, 2, 'expected two legs');
  const debit = legs.find((l) => l.type === 'Dr');
  const credit = legs.find((l) => l.type === 'Cr');
  assert.ok(debit && credit, 'expected one Dr and one Cr');
  assert.equal(Number(debit.amount), 125.5);
  assert.equal(Number(credit.amount), 125.5);
  assert.equal(debit.accountId, to.id);
  assert.equal(credit.accountId, from.id);
});

await scenario('updating a voucher replaces its posting instead of adding to it', async () => {
  const [from, to] = await twoAccounts();
  const id = await vouchers.createVoucher({
    voucherType: 'BV',
    amount: 40,
    date: today,
    paymentType: 'voucher_recieve',
    creditAccountId: from.id,
    debitAccountId: to.id,
    isApprove: 0,
    bankName: 'Test Bank',
    chequeNo: 'CHQ-1',
    chequeDate: today,
    referableId: 7,
    referableType: MorphType.Sale,
    createdBy: 1,
  });

  const before = await legsOf(id);
  assert.equal(before.length, 2);

  const documentsBefore = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.voucherId, id));
  assert.ok(documentsBefore.length >= 1, 'bank voucher should store cheque details');

  await vouchers.updateVoucher(id, {
    voucherType: 'BV',
    amount: 75,
    date: today,
    paymentType: 'voucher_recieve',
    creditAccountId: from.id,
    debitAccountId: to.id,
    isApprove: 0,
    bankName: 'Second Bank',
    chequeNo: 'CHQ-2',
    chequeDate: today,
    referableId: 7,
    referableType: MorphType.Sale,
    createdBy: 1,
  });

  const after = await legsOf(id);
  assert.equal(after.length, 2, 'update must replace the legs, not append');
  assert.equal(Number(after[0].amount), 75);

  const [voucher] = await db
    .select()
    .from(schema.vouchers)
    .where(eq(schema.vouchers.id, id))
    .limit(1);
  assert.equal(Number(voucher.amount), 75);
  assert.equal(voucher.referableId, 7, 'the invoice reference survives an edit');

  const documentsAfter = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.voucherId, id));
  assert.equal(
    documentsAfter.filter((d) => d.chequeNo === 'CHQ-2').length,
    1,
    'the cheque details are updated',
  );
});

await scenario('journal voucher keeps the main leg first and balances', async () => {
  const [main, sub] = await twoAccounts();
  const id = await journal.createJournalVoucher({
    voucherType: 'JV',
    amount: 60,
    date: today,
    accountType: 'debit',
    paymentType: 'journal_voucher',
    accountId: main.id,
    mainAmount: 60,
    narration: 'db-writes journal',
    subAccountId: [sub.id],
    subAmount: [60],
    subNarration: ['sub'],
    isApprove: 1,
    createdBy: 1,
  });

  const legs = await legsOf(id);
  assert.equal(legs.length, 2);
  assert.equal(legs[0].accountId, main.id, 'main leg is written first');
  assert.equal(legs[0].type, 'Dr');
  assert.equal(legs[1].type, 'Cr');

  const debits = legs
    .filter((l) => l.type === 'Dr')
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const credits = legs
    .filter((l) => l.type === 'Cr')
    .reduce((sum, l) => sum + Number(l.amount), 0);
  assert.equal(debits, credits, 'the voucher balances');
});

await scenario('deleting a voucher removes its transactions', async () => {
  const [from, to] = await twoAccounts();
  const id = await vouchers.createVoucher({
    voucherType: 'CV',
    amount: 10,
    date: today,
    paymentType: 'voucher_payment',
    creditAccountId: from.id,
    debitAccountId: to.id,
    isApprove: 0,
    createdBy: 1,
  });
  await vouchers.deleteVoucher(id);
  assert.equal((await legsOf(id)).length, 0);
});

await scenario('account balance follows the posted legs', async () => {
  const [account] = await twoAccounts();
  const before = await accounts.accountBalance(account);

  await vouchers.createVoucher({
    voucherType: 'CV',
    amount: 33,
    date: today,
    paymentType: 'voucher_recieve',
    creditAccountId: account.id,
    debitAccountId: (await twoAccounts())[1].id,
    isApprove: 1,
    createdBy: 1,
  });

  const after = await accounts.accountBalance(account);
  const type = Number(account.type);
  const expected = type === 1 || type === 3 ? before - 33 : before + 33;
  assert.equal(after, expected, `balance moved from ${before} to ${after}`);
});

await scenario('stock transfer moves stock once, on receipt', async () => {
  // A SKU with stock at a branch, and a different location to send it to.
  // A fresh install has no stock, so seed a row when there is none.
  let [source] = await db
    .select()
    .from(schema.stockReports)
    .where(sql`cast(${schema.stockReports.stock} as decimal(20,2)) >= 2`)
    .limit(1);

  if (!source) {
    let [sku] = await db.select().from(schema.productSku).limit(1);
    if (!sku) {
      // A fresh install ships no catalogue; create the smallest usable one.
      const [product] = await db.insert(schema.products).values({
        productName: `DB Writes Product ${Date.now()}`,
        productType: 'Single',
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const [inserted] = await db.insert(schema.productSku).values({
        productId: Number(product.insertId),
        sku: `DBW-${Date.now()}`,
        purchasePrice: 10,
        sellingPrice: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      [sku] = await db
        .select()
        .from(schema.productSku)
        .where(eq(schema.productSku.id, Number(inserted.insertId)))
        .limit(1);
    }
    assert.ok(sku, 'need a product SKU');
    const [branch] = await db.select().from(schema.showRooms).limit(1);
    assert.ok(branch, 'need a branch');
    await db.insert(schema.stockReports).values({
      houseableId: branch.id,
      houseableType: MorphType.ShowRoom,
      stockDate: today,
      productSkuId: sku.id,
      stock: '5',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    [source] = await db
      .select()
      .from(schema.stockReports)
      .where(
        and(
          eq(schema.stockReports.productSkuId, sku.id),
          eq(schema.stockReports.houseableId, branch.id),
        ),
      )
      .limit(1);
  }
  assert.ok(source, 'need a SKU with stock');

  const senderRef =
    source.houseableType === MorphType.WareHouse
      ? `warehouse-${source.houseableId}`
      : `showroom-${source.houseableId}`;

  let [otherShowroom] = await db
    .select()
    .from(schema.showRooms)
    .where(
      source.houseableType === MorphType.ShowRoom
        ? sql`${schema.showRooms.id} <> ${source.houseableId}`
        : sql`1 = 1`,
    )
    .limit(1);

  if (!otherShowroom) {
    const [inserted] = await db.insert(schema.showRooms).values({
      name: `DB Writes Branch ${Date.now()}`,
      status: 1,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    [otherShowroom] = await db
      .select()
      .from(schema.showRooms)
      .where(eq(schema.showRooms.id, Number(inserted.insertId)))
      .limit(1);
  }
  assert.ok(otherShowroom, 'need a second branch');

  const stockAt = async (id, type, skuId) => {
    const [row] = await db
      .select()
      .from(schema.stockReports)
      .where(
        and(
          eq(schema.stockReports.houseableId, id),
          eq(schema.stockReports.houseableType, type),
          eq(schema.stockReports.productSkuId, skuId),
        ),
      )
      .limit(1);
    return Number(row?.stock ?? 0);
  };

  const senderBefore = await stockAt(source.houseableId, source.houseableType, source.productSkuId);
  const receiverBefore = await stockAt(otherShowroom.id, MorphType.ShowRoom, source.productSkuId);

  const transferId = await transfers.createStockTransfer(
    {
      fromRef: senderRef,
      toRef: `showroom-${otherShowroom.id}`,
      date: today,
      lines: [{ productSkuId: source.productSkuId, price: 10, quantity: 1 }],
    },
    1,
  );
  assert.ok(transferId, 'transfer created');

  // Creating it must not move stock yet.
  assert.equal(
    await stockAt(source.houseableId, source.houseableType, source.productSkuId),
    senderBefore,
    'stock moves on receipt, not on creation',
  );

  await transfers.setTransferStatus(transferId, 1);
  const received = await transfers.receiveStockTransfer(transferId, 1);
  assert.notEqual(received, transfers.INSUFFICIENT_STOCK, 'sender had the stock');

  assert.equal(
    await stockAt(source.houseableId, source.houseableType, source.productSkuId),
    senderBefore - 1,
  );
  assert.equal(
    await stockAt(otherShowroom.id, MorphType.ShowRoom, source.productSkuId),
    receiverBefore + 1,
  );

  // Receiving again is a no-op, not a second movement.
  await transfers.receiveStockTransfer(transferId, 1);
  assert.equal(
    await stockAt(source.houseableId, source.houseableType, source.productSkuId),
    senderBefore - 1,
    'a repeated receipt must not move stock twice',
  );
});

await scenario('sale payment is recorded against the invoice', async () => {
  let [sale] = await db
    .select()
    .from(schema.sales)
    .orderBy(desc(schema.sales.id))
    .limit(1);

  if (!sale) {
    const [branch] = await db.select().from(schema.showRooms).limit(1);
    const [customer] = await db.select().from(schema.contacts).limit(1);
    const [inserted] = await db.insert(schema.sales).values({
      customerId: customer?.id ?? null,
      userId: 1,
      saleableId: branch?.id ?? 1,
      saleableType: MorphType.ShowRoom,
      date: today,
      invoiceNo: `DBW-${Date.now()}`,
      amount: 100,
      totalQuantity: 1,
      payableAmount: 100,
      isApproved: 0,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    [sale] = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.id, Number(inserted.insertId)))
      .limit(1);
  }
  assert.ok(sale, 'need a sale');

  // Anything beyond the outstanding balance is banked as `advance_amount`, so
  // count both columns - otherwise a fully paid invoice looks unchanged.
  const paidBefore = await db
    .select({
      total: sql`coalesce(sum(${schema.payments.amount} + ${schema.payments.advanceAmount}), 0)`,
    })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.payableId, sale.id),
        eq(schema.payments.payableType, MorphType.Sale),
      ),
    );

  await saleRepo.recordSalePayments(
    sale.id,
    [{ paymentMethod: 'cash', amount: 5, accountId: null }],
    1,
  );

  const paidAfter = await db
    .select({
      total: sql`coalesce(sum(${schema.payments.amount} + ${schema.payments.advanceAmount}), 0)`,
    })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.payableId, sale.id),
        eq(schema.payments.payableType, MorphType.Sale),
      ),
    );

  assert.equal(
    Number(paidAfter[0].total) - Number(paidBefore[0].total),
    5,
    'the payment is booked against the sale, as amount or advance',
  );
});

await scenario('creating a contact adds its ledger account with the PHP code', async () => {
  const id = await contactRepo.createContact(
    {
      contactType: 'Customer',
      name: `DB Writes Customer ${Date.now()}`,
      openingBalance: '0',
      payTermCondition: '',
      address: 'n/a',
    },
    1,
  );

  const [account] = await db
    .select()
    .from(schema.chartAccounts)
    .where(
      and(
        eq(schema.chartAccounts.contactableId, id),
        eq(schema.chartAccounts.contactableType, MorphType.ContactModel),
      ),
    )
    .limit(1);

  assert.ok(account, 'the contact has a ledger account');
  assert.equal(account.code, `01-05-${account.id}`, 'code is 0<type>-<parent>-<id>');

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, id))
    .limit(1);
  assert.ok(contact.contactId, 'the human-readable contact code is stamped');
});

await scenario('brand CSV import writes the rows it parsed', async () => {
  const csv = 'name,description\nDB Writes Brand A,first\nDB Writes Brand B,second\n';
  const file = new File([csv], 'brands.csv', { type: 'text/csv' });

  const { imported } = await imports.importBrands(file, 1);
  assert.equal(imported, 2);

  const rows = await db
    .select()
    .from(schema.brands)
    .where(sql`${schema.brands.name} like 'DB Writes Brand%'`);
  assert.ok(rows.length >= 2, 'both brands are in the table');
  assert.equal(rows[0].status, 1, 'status defaults to 1 as the PHP set it');
});

const failed = results.filter((r) => !r.ok);
console.log(`ran ${results.length} write scenarios: ${results.length - failed.length} ok, ${failed.length} failed`);
for (const result of results) {
  console.log(`  ${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.ok ? '' : ` - ${result.error}`}`);
}

await pool.end();
process.exit(failed.length ? 1 : 0);
