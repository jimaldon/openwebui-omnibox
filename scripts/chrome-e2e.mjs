#!/usr/bin/env node
// Optional end-to-end smoke test for the built Chrome extension.
//
// Loads .output/chrome-mv3 into a headless Chrome and checks that the MV3
// service worker registers, the options page renders, and the save flow
// persists the four frozen storage keys.
//
// Chrome ignores the `--load-extension` command-line switch (security policy),
// so the extension is loaded through the CDP `Extensions.loadUnpacked` command.
//
// Run `npm run build` first. Override the browser with CHROME_PATH.
//
// This is not wired into CI (throwaway runners only ship Chromium). It also
// cannot exercise the omnibox itself: there is no API to fire `onInputEntered`.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT_DIR = path.resolve(process.argv[2] ?? '.output/chrome-mv3');
const PORT = Number(process.env.CHROME_E2E_PORT ?? 9342);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : process.platform === 'win32'
        ? [
            `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
          ]
        : [];

  for (const candidate of candidates) if (existsSync(candidate)) return candidate;

  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  const which = process.platform === 'win32' ? 'where' : 'which';
  for (const name of names) {
    try {
      const found = execFileSync(which, [name], { encoding: 'utf8' }).split('\n')[0].trim();
      if (found) return found;
    } catch {
      // not on PATH
    }
  }
  return null;
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  };
  return {
    ready,
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    close: () => ws.close(),
  };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function getJson(pathname) {
  const res = await fetch(`http://127.0.0.1:${PORT}${pathname}`);
  return res.json();
}

let chrome;

try {
  if (!existsSync(EXT_DIR)) {
    throw new Error(`${EXT_DIR} not found. Run \`npm run build\` first.`);
  }
  if (typeof WebSocket === 'undefined') {
    throw new Error('This script needs Node 22+ (global WebSocket).');
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    throw new Error('No Chrome/Chromium found. Set CHROME_PATH to the browser binary.');
  }

  const profile = mkdtempSync(path.join(tmpdir(), 'owui-chrome-e2e-'));
  chrome = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-extension-debugging',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  chrome.stderr.on('data', (d) => (stderr += d.toString()));
  chrome.on('exit', (code) => {
    if (code) process.stderr.write(`Chrome exited with code ${code}.\n${stderr.slice(-500)}\n`);
  });

  let version;
  for (let i = 0; i < 50 && !version; i++) {
    try {
      version = await getJson('/json/version');
    } catch {
      await sleep(200);
    }
  }
  if (!version) throw new Error(`Chrome did not expose CDP.\n${stderr.slice(-800)}`);

  const browser = cdp(version.webSocketDebuggerUrl);
  await browser.ready;

  const { id: extensionId } = await browser.send('Extensions.loadUnpacked', { path: EXT_DIR });

  let targetInfos = [];
  for (let i = 0; i < 50; i++) {
    ({ targetInfos } = await browser.send('Target.getTargets'));
    if (targetInfos.some((t) => t.url === `chrome-extension://${extensionId}/background.js`)) break;
    await sleep(200);
  }
  const worker = targetInfos.find((t) => t.url === `chrome-extension://${extensionId}/background.js`);
  check('MV3 background service worker registers', Boolean(worker), worker?.url);

  const { targetId } = await browser.send('Target.createTarget', {
    url: `chrome-extension://${extensionId}/options.html`,
  });

  let pageWs;
  for (let i = 0; i < 25; i++) {
    const list = await getJson('/json/list');
    const page = list.find((t) => t.id === targetId && t.webSocketDebuggerUrl);
    if (page) {
      pageWs = page.webSocketDebuggerUrl;
      break;
    }
    await sleep(200);
  }
  if (!pageWs) throw new Error('Options page target never appeared');

  const page = cdp(pageWs);
  await page.ready;
  await page.send('Runtime.enable');

  const title = await page.send('Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true,
  });
  check('Options page loads', title.result.value === 'Open-WebUI-Omnibox Settings', title.result.value);

  const controls = await page.send('Runtime.evaluate', {
    expression:
      "['openWebUIUrl','openWebUIModel','webSearchEnabled','save','banner'].every((id) => document.getElementById(id) !== null)",
    returnByValue: true,
  });
  check('Options controls present', controls.result.value === true);

  await page.send('Runtime.evaluate', {
    expression: `(async () => {
      document.getElementById('openWebUIUrl').value = 'https://example.test/openwebui';
      document.getElementById('openWebUIModel').value = 'gpt-4o';
      document.getElementById('webSearchEnabled').checked = true;
      document.getElementById('save').click();
      await new Promise((resolve) => setTimeout(resolve, 300));
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const stored = await page.send('Runtime.evaluate', {
    expression:
      "chrome.storage.local.get(['openWebUIUrl','openWebUIModel','webSearchEnabled','showUrlNeededBanner'])",
    awaitPromise: true,
    returnByValue: true,
  });
  const keys = stored.result.value;
  check(
    'Settings persist under the frozen keys',
    keys.openWebUIUrl === 'https://example.test/openwebui' &&
      keys.openWebUIModel === 'gpt-4o' &&
      keys.webSearchEnabled === true,
    JSON.stringify(keys),
  );

  const status = await page.send('Runtime.evaluate', {
    expression: "document.getElementById('status').textContent",
    returnByValue: true,
  });
  check('Save confirmation shown', status.result.value === 'Options saved.', JSON.stringify(status.result.value));

  page.close();
  browser.close();
  rmSync(profile, { recursive: true, force: true });
} catch (err) {
  check('chrome e2e completed', false, String(err?.message ?? err));
} finally {
  chrome?.kill('SIGKILL');
  await sleep(200);
  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 && results.length > 0 ? 0 : 1);
}
