import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { SignJWT } from 'jose';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';
import { launchBrowser, openPage } from './lib/cdp.mjs';
loadEnv();
const base = process.env.BASE_URL ?? 'http://localhost:3100';
const db = await mysql.createConnection({host:process.env.DB_HOST??'localhost',port:Number(process.env.DB_PORT??3306),user:process.env.DB_USERNAME??'root',password:process.env.DB_PASSWORD??'',database:process.env.DB_DATABASE??'software_erp'});
const [[admin]] = await db.query('select u.id,u.role_id,r.type from users u left join roles r on r.id=u.role_id order by u.role_id asc limit 1');
await db.end();
const token=await new SignJWT({uid:admin.id,roleId:admin.role_id,roleType:admin.type,showroomId:1,staffId:null,locale:'en'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(requireSessionSecret()));
const browser=await launchBrowser({port:9441});
try {
 const page=await openPage(browser);
 await page.setCookie(process.env.SESSION_COOKIE??'infix_biz_session',token,new URL(base).hostname);
 await page.goto(base+'/home');
 console.log('Loaded page:', await page.currentUrl());
 console.log('Initial errors:', JSON.stringify(await page.errors()));
 await page.waitUntil("document.body.innerText.includes('Welcome back')",{timeout:15000});
 mkdirSync('artifacts/dashboard',{recursive:true});
 for (const [name,width,dark] of [['desktop',1440,false],['mobile',390,false],['dark',1440,true]]) {
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600},page.sessionId);
  await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
  await page.evaluate('new Promise(r=>setTimeout(r,800))');
  const result=await page.evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth, charts:document.querySelectorAll('.recharts-surface').length, primary:getComputedStyle(document.querySelector('.erp-theme')).getPropertyValue('--primary').trim(), text:document.body.innerText.includes('Sales throughput')})`);
  console.log(name,JSON.stringify(result));
  assert.equal(result.overflow,false,`${name}: page overflow`);
  assert.ok(result.primary,`${name}: invalid primary token`);
  assert.ok(result.text,'Dashboard missing');
  const {data}=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},page.sessionId);
  writeFileSync(`artifacts/dashboard/${name}.png`,Buffer.from(data,'base64'));
 }
 const errors = await page.errors();
 console.log('Browser errors:',JSON.stringify(errors));
 assert.equal(errors.length,0,'Browser reported rendering errors');
} finally { await browser.close(); }
