// Diagnoses why a dev-served page does not hydrate.
import { launchBrowser, openPage, sleep } from './lib/cdp.mjs';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const path = process.env.PROBE_PATH ?? '/login';

const browser = await launchBrowser({ port: Number(process.env.CDP_PORT ?? 9350) });
const page = await openPage(browser);

const events = [];
browser.onEvent((payload) => {
  if (payload.method === 'Runtime.exceptionThrown') {
    const details = payload.params?.exceptionDetails;
    events.push('EXCEPTION ' + (details?.exception?.description ?? details?.text ?? '').split('\n')[0]);
  }
  if (payload.method === 'Log.entryAdded') {
    const entry = payload.params?.entry;
    events.push(`LOG[${entry.level}] ${String(entry.text).slice(0, 200)}`);
  }
});
await browser.send('Log.enable', {}, page.sessionId);

await page.goto(`${base}${path}`);
await sleep(5000);

const report = await page.evaluate(`
  (() => {
    const inline = [...document.querySelectorAll('script:not([src])')];
    const flightScripts = inline.filter((s) => s.textContent.includes('__next_f'));
    return {
      url: location.pathname,
      readyState: document.readyState,
      totalScripts: document.scripts.length,
      inlineScripts: inline.length,
      flightScriptCount: flightScripts.length,
      firstFlightTag: flightScripts[0]?.outerHTML.slice(0, 120) ?? null,
      nextF: typeof window.__next_f + ':' + (window.__next_f?.length ?? 'n/a'),
      reactNodes: [...document.querySelectorAll('*')].filter((n) =>
        Object.getOwnPropertyNames(n).some((k) => k.startsWith('__react')),
      ).length,
      // Does a plain inline script run at all in this document?
      canRunInline: (() => {
        try {
          const s = document.createElement('script');
          s.textContent = 'window.__inlineRan = true;';
          document.head.appendChild(s);
          return window.__inlineRan === true;
        } catch (error) {
          return 'threw: ' + error.message;
        }
      })(),
      cspMeta: [...document.querySelectorAll('meta[http-equiv]')].map((m) => m.httpEquiv),
    };
  })()
`);

console.log(JSON.stringify(report, null, 1));
console.log('--- protocol events ---');
console.log(events.slice(0, 20).join('\n') || '(none)');

await page.close();
await browser.close();
