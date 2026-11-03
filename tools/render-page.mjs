#!/usr/bin/env node
// Render a local HTML file at a fixed viewport to PNG. Dev tool only.
import fs from 'node:fs/promises';
const PORT = process.env.CDP_PORT || '9225';
const [file, out, w, h] = process.argv.slice(2);
const url = 'file://' + (file.startsWith('/') ? file : process.cwd() + '/' + file);
const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false });
await sleep(900);
const shot = await send('Page.captureScreenshot', { format: 'png' });
await fs.writeFile(out, Buffer.from(shot.data, 'base64'));
ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${created.id}`);
console.log('wrote', out);
