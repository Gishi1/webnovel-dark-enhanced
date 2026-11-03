#!/usr/bin/env node
// Renders icons/icon{16,32,48,128}.png from a local SVG page via CDP. Dev tool only.
import fs from 'node:fs/promises';
const PORT = process.env.CDP_PORT || '9223';
const SIZES = [16, 32, 48, 128];
const pageUrl = 'file:///tmp/wn-icon.html';

const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(pageUrl)}`, { method: 'PUT' })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Page.enable');
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await fs.mkdir('icons', { recursive: true });
for (const size of SIZES) {
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(`icons/icon${size}.png`, Buffer.from(shot.data, 'base64'));
  console.log('wrote', `icons/icon${size}.png`);
}
ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${created.id}`);
