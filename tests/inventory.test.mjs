import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, FormData, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
  return exports;
}
const { adjustmentInput } = load('lib/inventory/adjustment-input.ts');
const { transferInput } = load('lib/inventory/transfer-input.ts');
function form(values) { const f = new FormData(); for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) f.append(key, String(item)); return f; }
const adjustment = { warehouse_id: 'warehouse-2', ref_no: 'ADJ-1', date: '2026-09-12', recovery_amount: 2, product_id: [3, 4], product_quantity: [1, 2] };

test('adjustment validation rejects misaligned arrays instead of shifting quantities', () => {
  for (const product_quantity of [[1], [1, 'bad'], [1, -2], [1, Infinity]]) assert.ok(adjustmentInput(form({ ...adjustment, product_quantity })).fieldErrors.product_id);
  assert.equal(adjustmentInput(form(adjustment)).data.lines[1].quantity, 2);
});
test('adjustment validation checks dates, location, recovery amount, and reference', () => {
  const result = adjustmentInput(form({ ...adjustment, warehouse_id: 'bad-2', date: '2026-02-31', recovery_amount: 'no', ref_no: '' }));
  for (const key of ['warehouse_id', 'date', 'recovery_amount', 'ref_no']) assert.ok(result.fieldErrors[key]);
});
test('transfer validation rejects invalid prices and duplicate SKUs', () => {
  const values = { from: 'warehouse-2', to: 'showroom-1', date: '2026-09-12', product_id: [3, 4], quantity: [2, 1], product_price: [8, 9] };
  assert.equal(Object.keys(transferInput(form(values)).fieldErrors).length, 0);
  assert.ok(transferInput(form({ ...values, product_price: [8, 'bad'] })).fieldErrors.product_id);
  assert.ok(transferInput(form({ ...values, product_id: [3, 3] })).fieldErrors.product_id);
});

function fixture() {
  const names = ['productItemDetails', 'productHistories', 'productSku', 'products', 'showRooms', 'stockAdjustmentProducts', 'stockAdjustments', 'stockReports', 'stockTransfers', 'wareHouses'];
  const schema = Object.fromEntries(names.map((name) => [name, new Proxy({ name }, { get: (target, key) => key === 'name' ? target.name : key })]));
  const data = new Map(names.map((name) => [schema[name], []]));
  const rows = (name) => data.get(schema[name]);
  rows('wareHouses').push({ id: 2 }); rows('showRooms').push({ id: 1 });
  rows('productSku').push({ id: 3, purchasePrice: 20 }, { id: 4, purchasePrice: 30 });
  rows('stockAdjustments').push({ id: 7, status: 0, createdBy: 5 });
  rows('stockAdjustmentProducts').push({ id: 1, stockAdjustmentId: 7, productSkuId: 3, qty: 1 });
  rows('productHistories').push({ id: 1, houseableId: 7, houseableType: 'Adjustment', productSkuId: 3, itemableId: 2, itemableType: 'Warehouse', inOut: 1 });
  rows('stockTransfers').push({ id: 8, status: 0, sendableId: 2, sendableType: 'Warehouse', receivableId: 1, receivableType: 'Showroom' });
  rows('productItemDetails').push({ id: 11, itemableId: 8, itemableType: 'Transfer', productSkuId: 3, quantity: 5, price: 10, returnQuantity: 1 });
  rows('stockReports').push({ id: 1, houseableId: 2, houseableType: 'Warehouse', productSkuId: 3, stock: '10' });
  const db = {
    select: () => ({ from: (table) => {
      let condition = () => true, limit;
      const query = { where: (value) => { condition = value; return query; }, limit: (value) => { limit = value; return query; }, for: () => query, orderBy: () => query,
        then: (resolve, reject) => Promise.resolve(data.get(table).filter(condition).slice(0, limit).map((row) => ({ ...row }))).then(resolve, reject) };
      return query;
    } }),
    insert: (table) => ({ values: async (value) => { const records = data.get(table); const id = Math.max(0, ...records.map((row) => row.id)) + 1; records.push({ id, ...value }); return [{ insertId: id }]; } }),
    update: (table) => ({ set: (value) => ({ where: async (condition) => { for (const row of data.get(table).filter(condition)) Object.assign(row, value); } }) }),
    delete: (table) => ({ where: async (condition) => data.set(table, data.get(table).filter((row) => !condition(row))) }),
  };
  const stock = {
    parseLocation: (ref) => ({ id: Number(ref.split('-')[1]), type: ref.startsWith('warehouse') ? 'Warehouse' : 'Showroom' }),
    stockValue: Number, MovementType: { StockAdjustment: 'stock_adjustment' },
    deleteMovementsFor: async (type, id) => data.set(schema.productHistories, rows('productHistories').filter((r) => !(r.houseableId === id && r.houseableType === type))),
    recordMovement: async (value) => { rows('productHistories').push({ id: 15, houseableId: value.documentId, houseableType: value.documentType, itemableId: value.location.id, itemableType: value.location.type, productSkuId: value.productSkuId, inOut: value.quantity, status: 0 }); },
    adjustStock: async (location, sku, delta) => { let row = rows('stockReports').find((r) => r.houseableId === location.id && r.houseableType === location.type && r.productSkuId === sku); if (!row) { row = { id: 10, houseableId: location.id, houseableType: location.type, productSkuId: sku, stock: '0' }; rows('stockReports').push(row); } row.stock = String(Number(row.stock) + delta); },
  };
  const repository = load('lib/inventory/transfers.ts', { 'server-only': {}, 'drizzle-orm': { eq: (key, value) => (row) => row[key] === value, and: (...conditions) => (row) => conditions.every((fn) => fn(row)), sql: () => () => true }, '@/lib/db/schema': schema, '@/lib/db/morph': { MorphType: { WareHouse: 'Warehouse', ShowRoom: 'Showroom', StockTransfer: 'Transfer', StockAdjustment: 'Adjustment', ProductSku: 'Sku' } }, '@/lib/db/client': { db, transaction: async (fn) => { const snapshot = [...data].map(([key, value]) => [key, structuredClone(value)]); try { return await fn(db); } catch (error) { for (const [key, value] of snapshot) data.set(key, value); throw error; } } }, './stock': stock, '@/lib/php-date': { today: () => '2026-09-12', toDateString: (date) => date } });
  return { ...repository, rows };
}

test('editing adjustment replaces histories and reprices lines without changing stock or creator', async () => {
  const f = fixture(); await f.updateStockAdjustment(7, adjustmentInput(form(adjustment)).data, 9);
  assert.equal(f.rows('stockAdjustmentProducts').length, 2);
  assert.equal(f.rows('stockAdjustmentProducts')[1].subtotal, 60);
  assert.equal(f.rows('productHistories').length, 2);
  assert.equal(f.rows('stockReports')[0].stock, '10');
  assert.equal(f.rows('stockAdjustments')[0].createdBy, 5);
  assert.equal(f.rows('stockAdjustments')[0].updatedBy, 9);
});
test('missing SKU rolls back adjustment line replacement', async () => {
  const f = fixture(); const data = adjustmentInput(form({ ...adjustment, product_id: [3, 999] })).data;
  await assert.rejects(f.updateStockAdjustment(7, data, 9), /Product not found/);
  assert.equal(f.rows('stockAdjustmentProducts').length, 1);
  assert.equal(f.rows('stockAdjustmentProducts')[0].id, 1);
});
test('approval is idempotent and approved adjustments reject edits and deletion', async () => {
  const f = fixture(); await f.applyStockAdjustment(7, 9); await f.applyStockAdjustment(7, 9);
  assert.equal(f.rows('stockReports')[0].stock, '9');
  await assert.rejects(f.updateStockAdjustment(7, adjustmentInput(form(adjustment)).data, 9), /cannot be edited/);
  await assert.rejects(f.deleteStockAdjustment(7), /cannot be deleted/);
});
test('transfer editing keeps item identity and returns, corrects sender type, and adds lines', async () => {
  const f = fixture(); await f.updateStockTransfer(8, { fromRef: 'warehouse-2', toRef: 'showroom-1', date: '2026-09-12', lines: [{ productSkuId: 3, price: 12, quantity: 6 }, { productSkuId: 4, price: 20, quantity: 1 }] }, 9);
  assert.equal(f.rows('stockTransfers')[0].sendableType, 'Warehouse');
  const line = f.rows('productItemDetails')[0]; assert.equal(line.id, 11); assert.equal(line.returnQuantity, 1); assert.equal(line.subTotal, 72);
  assert.equal(f.rows('productItemDetails').length, 2);
  assert.equal(f.rows('stockReports')[0].stock, '10');
});
test('transfer receipt requires approval and repeated receipt cannot move stock twice', async () => {
  const f = fixture(); await assert.rejects(f.receiveStockTransfer(8, 9), /Approve/);
  f.rows('stockTransfers')[0].status = 1;
  await f.receiveStockTransfer(8, 9); await f.receiveStockTransfer(8, 9);
  assert.equal(f.rows('stockReports')[0].stock, '6');
  assert.equal(f.rows('stockReports')[1].stock, '4');
  assert.equal(f.rows('productHistories').length, 1);
});
test('transfer checks gross quantity and leaves all stock unchanged on insufficient stock', async () => {
  const f = fixture(); f.rows('stockTransfers')[0].status = 1; f.rows('stockReports')[0].stock = '4';
  assert.equal(await f.receiveStockTransfer(8, 9), f.INSUFFICIENT_STOCK);
  assert.equal(f.rows('stockReports')[0].stock, '4');
  assert.equal(f.rows('stockTransfers')[0].receivedAt, undefined);
});
