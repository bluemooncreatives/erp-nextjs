// Submits server actions to a RUNNING server and checks what they wrote.
//
//   BASE_URL=http://localhost:3100 DB_HOST=... node scripts/verify-actions.mjs
//
// The HTTP sweep only issues GETs, so form handling was never exercised over
// the wire. This posts each action the way a browser without JavaScript does -
// a multipart form carrying `$ACTION_ID_<id>` - which is also the path Next
// uses before hydration, then asserts the rows in the database.
//
// It WRITES. Point it at a scratch database, never at production.

import fs, { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';

loadEnv();
if (!process.env.DB_DATABASE?.startsWith('erp_migration_')) throw new Error('Set DB_DATABASE to an isolated erp_migration_ database.');

const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const base = process.env.BASE_URL ?? 'http://localhost:3100';
const secret = requireSessionSecret();
const cookieName = process.env.SESSION_COOKIE ?? 'infix_biz_session';

// --- Action ids ------------------------------------------------------------

const manifest = JSON.parse(
  readFileSync('.next/server/server-reference-manifest.json', 'utf8'),
).node;

/** Find an action by its exported name, and a page that can serve it. */
function action(exportedName, fileHint) {
  const entries = Object.entries(manifest).filter(
    ([, value]) =>
      value.exportedName === exportedName &&
      (!fileHint || String(value.filename).includes(fileHint)),
  );
  assert.equal(entries.length > 0, true, `no action named ${exportedName}`);
  const [id, value] = entries[0];
  // An action is served by every page that imports it. Post to one with no
  // dynamic segment: posting to `/contact/add_contact/[id]/edit` would run the
  // action and then fail rendering the reply, because the literal `[id]` is
  // not a row id - a 500 that says nothing about the action under test.
  const pages = Object.keys(value.workers);
  const page = pages.find((name) => !name.includes('[')) ?? pages[0];
  return { id, url: pageUrl(page) };
}

/** `app/(dashboard)/setup/printer/page` -> `/setup/printer` */
function pageUrl(page) {
  const path = page
    .replace(/^app/, '')
    .replace(/\/page$/, '')
    .replace(/\/\([^)]+\)/g, '');
  return path === '' ? '/' : path;
}

// --- Session ---------------------------------------------------------------

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'software_erp',
});

/** The same session, in a chosen locale - for the translation check. */

async function sessionFor(roleId) {
  const [[user]] = await connection.query(
    `select u.id, u.role_id, r.type from users u
       left join roles r on r.id = u.role_id
      where (? is null or u.role_id = ?)
      order by u.role_id asc limit 1`,
    [roleId ?? null, roleId ?? null],
  );
  assert.ok(user, `no user for role ${roleId}`);

  const [[showroom]] = await connection.query('select id from show_rooms limit 1');

  return new SignJWT({
    uid: user.id,
    roleId: user.role_id,
    roleType: user.type ?? 'system_user',
    showroomId: showroom?.id ?? 1,
    staffId: null,
    locale: 'en',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(secret));
}

const adminToken = await sessionFor(null);

/** Post one action, as a browser without JavaScript would. */
async function submit(target, fields, options = {}) {
  const form = new FormData();
  form.set(`$ACTION_ID_${target.id}`, '');
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item instanceof Blob) form.append(key, item, options.filename ?? 'upload.csv');
      else form.append(key, String(item));
    }
  }

  const response = await fetch(`${base}${options.url ?? target.url}`, {
    method: 'POST',
    headers: {
      cookie: `${cookieName}=${options.token ?? adminToken}`,
      origin: base,
    },
    body: form,
    redirect: 'manual',
  });

  return response;
}

/** The polymorphic class names, bound as parameters - MySQL unescapes
 * backslashes inside string literals, so these cannot be inlined. */
const MORPH = {
  sale: 'Modules\\Sale\\Entities\\Sale',
  purchaseOrder: 'Modules\\Purchase\\Entities\\PurchaseOrder',
  voucher: 'Modules\\Account\\Entities\\Voucher',
  showRoom: 'Modules\\Inventory\\Entities\\ShowRoom',
  contact: 'Modules\\Contact\\Entities\\ContactModel',
};

const rows = async (sql, params = []) => (await connection.query(sql, params))[0];
const one = async (sql, params = []) => (await rows(sql, params))[0];


const stamp = Date.now();
const results = [];
async function scenario(name, run) {
 try { await run(); results.push({name,ok:true}); console.log('ok',name); }
 catch(error) { results.push({name,ok:false,error:String(error)}); console.log('FAIL',name,String(error)); }
}
const admin = await one('SELECT id FROM users ORDER BY role_id, id LIMIT 1');
const stock = await one(`SELECT s.*, ps.selling_price, ps.min_selling_price, p.product_name FROM stock_reports s
 JOIN product_sku ps ON ps.id=s.product_sku_id JOIN products p ON p.id=ps.product_id
 JOIN chart_accounts ca ON ca.contactable_id=s.houseable_id AND ca.contactable_type=s.houseable_type
 WHERE p.product_type <> 'Service' AND NOT EXISTS (SELECT 1 FROM part_numbers pn WHERE pn.product_sku_id=ps.id)
 LIMIT 1`);
assert.ok(stock,'stock fixture with cash account');
await connection.query('UPDATE stock_reports SET stock = 40 WHERE id=?',[stock.id]);
const customer = await one(`SELECT c.id, ca.id account_id FROM contacts c JOIN chart_accounts ca ON ca.contactable_id=c.id AND ca.contactable_type=? WHERE c.contact_type='Customer' LIMIT 1`,[MORPH.contact]);
assert.ok(customer,'customer with ledger fixture');
const price = Math.max(Number(stock.selling_price),Number(stock.min_selling_price),100);
const posUrl='/pos/pos-order-products';
const checkout=action('checkoutPos');
const payload={customer_id:`customer-${customer.id}`,warehouse_id:`${stock.houseable_type===MORPH.showRoom?'showroom':'warehouse'}-${stock.houseable_id}`,date:new Date().toISOString().slice(0,10),items:stock.product_sku_id,item_price:price,item_quantity:1,product_tax:0,item_discount:0,discount_type:1,_discount_value:0,_tax_id:0,shipping_charge:0,other_charge:0,payment_method:'quick cash',payment_amount:price+50,item_amount:1,total_amount:1,ref_no:`POS-${stamp}`};
let sale;
await scenario('POS checkout posts server totals, stock, payment, vouchers and a receipt',async()=>{
 const response=await submit(checkout,payload,{url:posUrl});
 const text=await response.text();
 assert.ok(response.status<400,`HTTP ${response.status}: ${text.slice(-500)}`);
 sale=await one('SELECT * FROM sales WHERE ref_no=?',[payload.ref_no]);assert.ok(sale,'sale created');
 assert.equal(Number(sale.type),2);assert.equal(Number(sale.is_approved),1);assert.equal(Number(sale.payable_amount),price);
 assert.equal(Number((await one('SELECT stock FROM stock_reports WHERE id=?',[stock.id])).stock),39);
 const payment=await one('SELECT * FROM payments WHERE payable_id=? AND payable_type=?',[sale.id,MORPH.sale]);
 assert.equal(Number(payment.amount),price);assert.equal(Number(payment.return_amount),50);
 assert.ok(Number((await one('SELECT COUNT(*) n FROM vouchers WHERE referable_id=? AND referable_type=?',[sale.id,MORPH.sale])).n)>=3,'revenue, cost and receipt vouchers');
 assert.ok(response.headers.get('location')?.includes(`/pos/receipt/${sale.id}`),'redirects to POS receipt');
 const receipt=await fetch(`${base}/pos/receipt/${sale.id}`,{headers:{cookie:`${cookieName}=${adminToken}`}});assert.equal(receipt.status,200);assert.match(await receipt.text(),/Next checkout/);
});
await scenario('POS rejects invalid quantity without writes',async()=>{
 const before=Number((await one('SELECT COUNT(*) n FROM sales')).n);
 await submit(checkout,{...payload,ref_no:`NEG-${stamp}`,item_quantity:-1},{url:posUrl});
 assert.equal(Number((await one('SELECT COUNT(*) n FROM sales')).n),before);
});
await scenario('POS rollback removes sale, payment and stock writes when ledger is missing',async()=>{
 const before=Number((await one('SELECT COUNT(*) n FROM sales')).n);
 const beforeStock=(await one('SELECT stock FROM stock_reports WHERE id=?',[stock.id])).stock;
 await connection.query('UPDATE chart_accounts SET contactable_id=0 WHERE id=?',[customer.account_id]);
 try { await submit(checkout,{...payload,ref_no:`ROLLBACK-${stamp}`},{url:posUrl}); }
 finally { await connection.query('UPDATE chart_accounts SET contactable_id=? WHERE id=?',[customer.id,customer.account_id]); }
 assert.equal(Number((await one('SELECT COUNT(*) n FROM sales')).n),before);
 assert.equal((await one('SELECT stock FROM stock_reports WHERE id=?',[stock.id])).stock,beforeStock);
});
const projectUuid=crypto.randomUUID();
const [projectInsert]=await connection.query('INSERT INTO projects (name,uuid,user_id,privacy,default_view) VALUES (?,?,?,1,?)',[`Migration ${stamp}`,projectUuid,admin.id,'board']);
const projectId=projectInsert.insertId;
await connection.query('INSERT INTO project_user (project_id,user_id) VALUES (?,?)',[projectId,admin.id]);
const sectionIds=[];for(const name of ['To do','Done']){const [row]=await connection.query('INSERT INTO sections (project_id,name) VALUES (?,?)',[projectId,name]);sectionIds.push(row.insertId);}
const taskIds=[];const taskUuids=[];
for(const name of ['First task','Second task']){const uuid=crypto.randomUUID();const [row]=await connection.query('INSERT INTO tasks (project_id,section_id,uuid,name,created_by) VALUES (?,?,?,?,?)',[projectId,sectionIds[0],uuid,name,admin.id]);taskIds.push(row.insertId);taskUuids.push(uuid);}
const projectUrl=`/project/${projectUuid}/board`;
const fieldAction=action('updateFieldAction');
const reorder=action('reorderProjectItem');
let fieldId;
await scenario('Project custom fields create, update a task value and render on board',async()=>{
 const response=await submit(fieldAction,{project_id:projectId,operation:'save',name:`Priority ${stamp}`,type:'dropdown',options:'Low\nHigh'},{url:projectUrl});assert.ok(response.status<400);
 const field=await one('SELECT * FROM fields WHERE name=?',[`Priority ${stamp}`]);assert.ok(field,'field created');fieldId=field.id;
 const option=await one('SELECT * FROM field_options WHERE field_id=? ORDER BY id DESC LIMIT 1',[fieldId]);
 await submit(fieldAction,{project_id:projectId,task_id:taskIds[0],field_id:fieldId,operation:'value',value:option.id},{url:`/task/${taskUuids[0]}`});
 const value=await one('SELECT * FROM field_task WHERE task_id=? AND field_id=?',[taskIds[0],fieldId]);assert.equal(value.option_id,option.id);
 const board=await fetch(base+projectUrl,{headers:{cookie:`${cookieName}=${adminToken}`}});assert.equal(board.status,200);assert.match(await board.text(),/High/);
 assert.ok(await one('SELECT id FROM task_comments WHERE task_id=? AND field_id=?',[taskIds[0],fieldId]),'field change in activity');
});
await scenario('Project moves and orders cards, then persists after reload',async()=>{
 await submit(reorder,{project_id:projectId,kind:'task',id:taskIds[0],target:sectionIds[1],position:0},{url:projectUrl});
 const task=await one('SELECT section_id, `order` FROM tasks WHERE id=?',[taskIds[0]]);assert.equal(task.section_id,sectionIds[1]);assert.equal(task.order,0);
 await submit(reorder,{project_id:projectId,kind:'section',id:sectionIds[1],target:'',position:0},{url:projectUrl});
 assert.equal((await one('SELECT `order` FROM sections WHERE id=?',[sectionIds[1]])).order,0);
});
await scenario('Project field visibility and removal clean up task values',async()=>{
 assert.ok(fieldId);
 await submit(fieldAction,{project_id:projectId,field_id:fieldId,operation:'visibility'},{url:projectUrl});
 assert.equal((await one('SELECT visibility FROM field_project WHERE field_id=? AND project_id=?',[fieldId,projectId])).visibility,0);
 await submit(fieldAction,{project_id:projectId,field_id:fieldId,operation:'delete'},{url:projectUrl});
 assert.equal((await one('SELECT COUNT(*) n FROM field_task WHERE field_id=?',[fieldId])).n,0);
});
await scenario('Project refuses a task move to a section outside its project',async()=>{
 const before=await one('SELECT section_id FROM tasks WHERE id=?',[taskIds[0]]);
 await submit(reorder,{project_id:projectId,kind:'task',id:taskIds[0],target:999999999,position:0},{url:projectUrl});
 assert.equal((await one('SELECT section_id FROM tasks WHERE id=?',[taskIds[0]])).section_id,before.section_id);
});

await scenario('Project text, number, date and person fields preserve typed values',async()=>{
 for (const [type,value,column] of [['text','Specification','text'],['number','12.5','number'],['date','2026-10-10','date'],['user_id',String(admin.id),'user_id']]) {
  const name=`Typed ${type} ${stamp}`;
  await submit(fieldAction,{project_id:projectId,operation:'save',name,type},{url:projectUrl});
  const field=await one('SELECT id FROM fields WHERE name=?',[name]);assert.ok(field,name);
  await submit(fieldAction,{project_id:projectId,task_id:taskIds[0],field_id:field.id,operation:'value',value},{url:`/task/${taskUuids[0]}`});
  const stored=await one('SELECT * FROM field_task WHERE field_id=? AND task_id=?',[field.id,taskIds[0]]);
  assert.ok(stored,`${type} value created`);
  if (type==='date') assert.equal(new Date(stored.date).toISOString().slice(0,10),value);
  else assert.equal(String(stored[column]),value);
 }
});
await scenario('Project sub-task order persists independently of board cards',async()=>{
 const childIds=[];
 for(const name of ['Child one','Child two']) { const [result]=await connection.query('INSERT INTO tasks (project_id,section_id,parent_id,uuid,name) VALUES (?,?,?,?,?)',[projectId,sectionIds[1],taskIds[0],crypto.randomUUID(),name]);childIds.push(result.insertId); }
 await submit(reorder,{project_id:projectId,kind:'subtask',id:childIds[1],target:taskIds[0],position:0},{url:`/task/${taskUuids[0]}`});
 assert.equal((await one('SELECT id FROM tasks WHERE parent_id=? ORDER BY `order` LIMIT 1',[taskIds[0]])).id,childIds[1]);
 const response=await fetch(base+projectUrl,{headers:{cookie:`${cookieName}=${adminToken}`}});
 assert.doesNotMatch(await response.text(),/Child one/,'subtasks are not duplicate top-level cards');
});
await scenario('Project attachment larger than 1 MB uploads and deletes through server actions',async()=>{
 const upload=action('uploadTaskAttachment'), remove=action('removeTaskAttachment');
 const file=new Blob(['%PDF-1.4\n',new Uint8Array(1200*1024)],{type:'application/pdf'});
 const response=await submit(upload,{task_id:taskIds[0],file},{url:`/task/${taskUuids[0]}`,filename:`large-${stamp}.pdf`});
 assert.ok(response.status<400,`upload returned ${response.status}`);
 const row=await one('SELECT * FROM uploads WHERE module_id=? AND user_filename=?',[taskIds[0],`large-${stamp}.pdf`]);assert.ok(row,'upload row exists');
 await submit(remove,{upload_id:row.id},{url:`/task/${taskUuids[0]}`});
 assert.equal(await one('SELECT id FROM uploads WHERE id=?',[row.id]),undefined);
});
await scenario('Binary XLS imports through the existing brand upload action',async()=>{
 const target=action('uploadBrandCsv');
 const response=await submit(target,{file:new Blob([fs.readFileSync('tests/fixtures/legacy-import.xls')],{type:'application/vnd.ms-excel'})},{filename:'brands.xls'});
 assert.ok(response.status<400,`XLS upload returned ${response.status}`);
 assert.ok(await one('SELECT id FROM brands WHERE name=?',['Caf\u00e9']),'brand imported from binary workbook');
});
fs.writeFileSync('artifacts/migration-fixture.json',JSON.stringify({projectId,projectUuid,taskIds,taskUuids,sectionIds,customerId:customer.id,stock,price},null,2));
fs.writeFileSync('artifacts/migration-results.json',JSON.stringify(results,null,2));
await connection.end();
console.log(`${results.filter(r=>r.ok).length}/${results.length} migration scenarios passed`);
process.exitCode=results.some(r=>!r.ok)?1:0;
