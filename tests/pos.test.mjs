import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, modules = {}) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports, FormData, require: name => {assert.ok(name in modules, name);return modules[name];}});
 return exports;
}
const input = load('lib/sale/input.ts');
const {posInput} = load('lib/sale/pos-input.ts', {'./input': input});
const base = {customer_id:'customer-1',warehouse_id:'showroom-1',date:'2026-09-13',items:[1],item_price:[100],item_quantity:[2],product_tax:[10],item_discount:[5],discount_type:2,_discount_value:10,payment_method:'quick cash',payment_amount:250};
function form(values = {}) { const f = new FormData(); for(const [key,value] of Object.entries({...base,...values})) for(const v of Array.isArray(value)?value:[value]) f.append(key,String(v)); return f; }
test('POS ignores forged aggregate totals and sale type',()=>{
 const {input}=posInput(form({item_amount:1,total_amount:1,total_quantity:99,total_discount_amount:0,sale_type:0,quotation_id:5}));
 assert.equal(input.itemAmount,210);assert.equal(input.totalDiscountAmount,21);assert.equal(input.totalQuantity,2);assert.equal(input.saleType,2);assert.equal(input.quotationId,null);
});
test('POS rejects malformed arrays and duplicate product lines',()=>{
 for(const change of [{item_quantity:[]},{item_price:['bad']},{items:[1,1],item_price:[100,100],item_quantity:[1,1],product_tax:[0,0],item_discount:[0,0]},{items:['bad']},{items:[1,'bad'],item_price:[100,100],item_quantity:[1,1],product_tax:[0,0],item_discount:[0,0]}]) assert.throws(()=>posInput(form(change)));
});
test('POS rejects invalid quantity, negative and nonfinite amounts',()=>{
 for(const change of [{item_quantity:[0]},{item_price:[-1]},{item_price:[Infinity]},{product_tax:[101]},{item_discount:[101]},{shipping_charge:'bad'},{_discount_value:1000},{payment_amount:'bad'},{date:'2026-02-31'}]) assert.throws(()=>posInput(form(change)));
});
test('POS requires a valid party, location, tax and bank account',()=>{
 for(const change of [{customer_id:'agent-1'},{warehouse_id:'branch-1'},{_tax_id:'bad'},{payment_method:'card',payment_amount:200,account_id:''},{payment_method:'unknown'}]) assert.throws(()=>posInput(form(change)));
});
test('POS keeps serials attached to their SKU, not the first cart row',()=>{
 const {input} = posInput(form({items:[1,2],item_price:[100,100],item_quantity:[1,1],product_tax:[0,0],item_discount:[0,0],serial_no_1:[7],serial_no_2:[8]}));
 assert.deepEqual([...input.lines[0].partNumberIds],[7]);assert.deepEqual([...input.lines[1].partNumberIds],[8]);
});
test('POS permits equal numeric SKU and combo identifiers',()=>{
 const {input}=posInput(form({combo_product_id:[1],combo_product_price:[20],combo_product_quantity:[1]}));
 assert.equal(input.lines.length,2);assert.equal(input.lines[1].isCombo,true);assert.equal(input.itemAmount,230);
});
