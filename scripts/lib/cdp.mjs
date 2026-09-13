// A very small Chrome DevTools Protocol client.
//
// Node 22 ships a global WebSocket, so driving a headless browser needs no
// dependency: launch Chrome with a debugging port, open the page target, and
// speak CDP over the socket.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export function findBrowser() {
  return process.env.BROWSER_PATH ?? CANDIDATES.find((p) => existsSync(p)) ?? null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Launch headless Chrome/Edge and connect to it. */
export async function launchBrowser({ port = 9333 } = {}) {
  const binary = findBrowser();
  if (!binary) throw new Error('No Chrome or Edge found; set BROWSER_PATH.');

  const profile = mkdtempSync(path.join(tmpdir(), 'erp-cdp-'));
  const child = spawn(
    binary,
    [
      // HEADED=1 opens a real (off-screen) window, for comparing behaviour that
      // differs between headless and headed Chrome.
      ...(process.env.HEADED ? ['--window-position=-2400,0'] : ['--headless=new']),
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1400,1000',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );

  // Wait for the debugging endpoint to answer.
  let version = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        version = await response.json();
        break;
      }
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  if (!version) {
    child.kill();
    throw new Error('The browser did not open its debugging port.');
  }

  const browser = await connect(version.webSocketDebuggerUrl);

  return {
    ...browser,
    async close() {
      await browser.close();
      child.kill();
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        // the profile directory is in the temp dir; leaving it is harmless
      }
    },
  };
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject, timer } = pending.get(payload.id);
      clearTimeout(timer);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result);
      return;
    }
    for (const listener of listeners) listener(payload);
  });

  socket.addEventListener('close', () => {
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('Browser protocol connection closed.')); }
    pending.clear();
  });

  function send(method, params = {}, sessionId) {
    const id = nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    if (process.env.CDP_DEBUG) console.error('CDP', method);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser did not answer ${method}`)); }, Number(process.env.CDP_TIMEOUT ?? 30000));
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify(message));
    });
  }

  /**
   * Wait for one event. The default is generous because a dev server compiles
   * each route on its first request.
   */
  function waitFor(method, sessionId, timeout = Number(process.env.CDP_TIMEOUT ?? 90000)) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        listeners.delete(listener);
        reject(new Error(`timed out waiting for ${method}`));
      }, timeout);

      const listener = (payload) => {
        if (payload.method !== method) return;
        if (sessionId && payload.sessionId !== sessionId) return;
        clearTimeout(timer);
        listeners.delete(listener);
        resolve(payload.params);
      };
      listeners.add(listener);
    });
  }

  /** Subscribe to every protocol event; returns an unsubscribe function. */
  function onEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    send,
    waitFor,
    onEvent,
    async close() {
      socket.close();
    },
  };
}

/** Open a tab and return helpers bound to its session. */
export async function openPage(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });

  await browser.send('Page.enable', {}, sessionId);
  await browser.send('Runtime.enable', {}, sessionId);
  await browser.send('Network.enable', {}, sessionId);

  // Collect anything the page logs as an error, in every document it loads -
  // React reports hydration mismatches and render failures through console.error.
  await browser.send(
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: `
        window.__erpErrors = [];
        const original = console.error;
        console.error = (...args) => {
          try {
            window.__erpErrors.push(args.map((a) => String(a?.message ?? a)).join(' '));
          } catch {}
          original.apply(console, args);
        };
        window.addEventListener('error', (event) => {
          window.__erpErrors.push(String(event.message));
        });
        window.addEventListener('unhandledrejection', (event) => {
          window.__erpErrors.push('unhandled rejection: ' + String(event.reason));
        });
      `,
    },
    sessionId,
  );

  async function evaluate(expression, { awaitPromise = true } = {}) {
    const result = await browser.send(
      'Runtime.evaluate',
      { expression, awaitPromise, returnByValue: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          'evaluation failed',
      );
    }
    return result.result?.value;
  }

  async function goto(url, { waitUntilIdle = true } = {}) {
    const loaded = browser.waitFor('Page.loadEventFired', sessionId);
    await browser.send('Page.navigate', { url }, sessionId);
    await loaded;
    if (waitUntilIdle) await settle(evaluate);
    return currentUrl();
  }

  const currentUrl = () => evaluate('location.href');

  async function setCookie(name, value, domain) {
    await browser.send(
      'Network.setCookie',
      { name, value, domain, path: '/', httpOnly: true },
      sessionId,
    );
  }

  /**
   * Run an interaction until it takes effect.
   *
   * A dev server streams the HTML and hydrates a moment later, so a click can
   * land before React is listening and simply do nothing. Rather than guess at
   * React's internals, repeat the action until the page shows the result.
   */
  async function interactUntil(actionExpression, conditionExpression, options = {}) {
    const { timeout = 30000, interval = 400 } = options;
    const deadline = Date.now() + timeout;
    let lastError = null;

    for (;;) {
      if (await evaluate(`Boolean(${conditionExpression})`)) return true;

      try {
        await evaluate(actionExpression);
      } catch (error) {
        lastError = error; // the element may not be there yet
      }

      await sleep(interval);
      if (await evaluate(`Boolean(${conditionExpression})`)) return true;

      if (Date.now() > deadline) {
        throw new Error(
          `interaction did not take effect: ${conditionExpression}` +
            (lastError ? ` (last error: ${lastError.message})` : ''),
        );
      }
    }
  }

  /** Poll an expression until it is truthy. */
  async function waitUntil(expression, { timeout = 15000, interval = 150 } = {}) {
    const deadline = Date.now() + timeout;
    for (;;) {
      if (await evaluate(`Boolean(${expression})`)) return true;
      if (Date.now() > deadline) throw new Error(`timed out waiting for: ${expression}`);
      await sleep(interval);
    }
  }

  return {
    sessionId,
    evaluate,
    goto,
    currentUrl,
    setCookie,
    waitUntil,
    interactUntil,
    /** Errors the current document logged, newest last. */
    errors: () => evaluate('window.__erpErrors ?? []'),
    async close() {
      await browser.send('Target.closeTarget', { targetId });
    },
  };
}

/** Let React finish its work and the network go quiet. */
async function settle(evaluate) {
  await evaluate(
    'new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 250)))',
  );
}

export { sleep };
