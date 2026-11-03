#!/usr/bin/env node
// Load a page, collect console output/exceptions, run a check script, screenshot.
// usage: node tools/verify.mjs <url> <check.js> <out.png> [waitMs]
import fs from 'node:fs/promises';
const PORT = process.env.CDP_PORT || '9225';
const [url, checkFile, outPng, waitArg] = process.argv.slice(2);
const waitMs = Number(waitArg || process.env.WAIT_MS || 8000);

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.filter(t => t.type === 'page').find(t => t.url.includes('webnovel.com')) || list.find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
const logs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const type = m.params.type;
    if (type === 'error' || type === 'warning') logs.push({ kind: 'console.' + type, text: m.params.args.map(a => a.value ?? a.description ?? a.type).join(' ').slice(0, 500) });
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    logs.push({ kind: 'exception', text: (d.exception?.description || d.text || '').slice(0, 800), url: d.url, line: d.lineNumber });
  } else if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    if (e.level === 'error' || e.level === 'warning') logs.push({ kind: 'log.' + e.level, text: (e.text || '').slice(0, 400), url: e.url });
  }
};
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
if (process.env.VIEW_W) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(process.env.VIEW_W),
    height: Number(process.env.VIEW_H || 1000),
    deviceScaleFactor: 1,
    mobile: false
  });
}
await send('Page.navigate', { url });
await sleep(waitMs);
const expression = await fs.readFile(checkFile, 'utf8');
const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
const checks = r.exceptionDetails ? { error: r.exceptionDetails.exception?.description } : r.result.value;

const metrics = await send('Page.getLayoutMetrics');
const cs = metrics.cssContentSize || metrics.contentSize;
const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: Math.min(cs.width, 1600), height: Math.min(cs.height, 16000), scale: 0.62 }, captureBeyondViewport: true });
await fs.writeFile(outPng, Buffer.from(shot.data, 'base64'));

console.log(JSON.stringify({ url, finalUrl: (await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true })).result.value, checks, logs }, null, 2));
ws.close();
