import { SignJWT } from 'jose';
import { launchBrowser, openPage, sleep } from './lib/cdp.mjs';
import { loadEnv, requireSessionSecret } from './lib/env.mjs';
loadEnv();
const token = await new SignJWT({ uid: 1, roleId: 1, roleType: 'system_user', showroomId: 1, staffId: null, locale: 'ar' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h')
  .sign(new TextEncoder().encode(requireSessionSecret()));
const browser = await launchBrowser({ port: 9381 });
const page = await openPage(browser);
await page.setCookie('infix_biz_session', token, 'localhost');
await page.goto('http://localhost:3100/cashbooks');
await sleep(4000);
console.log(await page.evaluate(`(() => {
  const probes = [];
  for (const x of [window.innerWidth - 10, window.innerWidth - 30, window.innerWidth - 60]) {
    for (const y of [10, 25, 40]) {
      const el = document.elementFromPoint(x, y);
      if (el) probes.push({ x, y, tag: el.tagName, cls: String(el.className).slice(0, 50) });
    }
  }
  return JSON.stringify({ innerWidth: window.innerWidth, probes }, null, 1);
})()`));

await page.close(); await browser.close();
