#!/usr/bin/env node
// Reload the unpacked extension and refresh WebNovel tabs via CDP.
// The extension ID for an unpacked extension is derived from its absolute path.
import crypto from 'node:crypto';
const PORT = process.env.CDP_PORT || process.argv[2] || '9225';
const root = process.cwd();

function extensionId(dir) {
  const hex = crypto.createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

const id = extensionId(root);
const base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let n = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  };
  const send = (method, params = {}) => {
    const i = ++n;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((res, rej) => pending.set(i, { res, rej }));
  };
  return { ws, send };
}

const version = await (await fetch(`${base}/json/version`).catch(() => null));
if (!version) {
  console.error(`No browser is listening on ${base}.`);
  process.exit(1);
}

// Opening an extension page wakes the service worker and gives us a context
// where chrome.runtime.reload() is allowed.
let created;
try {
  created = await (await fetch(`${base}/json/new?${encodeURIComponent(`chrome-extension://${id}/src/options/options.html`)}`, { method: 'PUT' })).json();
  const { ws, send } = await connect(created);
  await send('Runtime.evaluate', { expression: 'chrome.runtime.reload()' }).catch(() => {});
  ws.close();
} catch (error) {
  console.warn('Could not trigger chrome.runtime.reload():', error.message);
}
await sleep(1800);

try {
  await fetch(`${base}/json/close/${created.id}`);
} catch (_) { /* already closed by the reload */ }

// Refresh site tabs so the new content scripts are injected.
const pages = (await (await fetch(`${base}/json/list`)).json())
  .filter((t) => t.type === 'page' && t.url.startsWith('https://www.webnovel.com/'));
for (const page of pages) {
  try {
    const { ws, send } = await connect(page);
    await send('Page.reload', { ignoreCache: true });
    ws.close();
  } catch (_) { /* tab may be closing */ }
}

console.log(`Reloaded extension ${id} and refreshed ${pages.length} WebNovel tab(s).`);
