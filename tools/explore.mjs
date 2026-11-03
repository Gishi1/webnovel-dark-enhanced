#!/usr/bin/env node
// Survey a webnovel.com page: outline, links, screenshot. Dev tool only.
import fs from 'node:fs/promises';
const PORT = process.env.CDP_PORT || '9223';
const OUT = process.env.OUT_DIR || '/tmp/wn-pages';

const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json())
  .filter(t => t.type === 'page').find(t => t.url.includes('webnovel.com')) ||
  (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page')[0];

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const outline = `(() => {
  const lines = []; const skip = new Set(['SCRIPT','STYLE','LINK','META','NOSCRIPT','SVG','PATH','USE','SYMBOL']);
  function walk(el, depth) {
    if (depth > 8 || skip.has(el.tagName)) return;
    const cls = (typeof el.className === 'string' && el.className.trim()) ? '.' + el.className.trim().split(/\\s+/).slice(0,8).join('.') : '';
    const kids = Array.from(el.children).filter(k => !skip.has(k.tagName));
    const text = kids.length === 0 ? (el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,50) : '';
    lines.push('  '.repeat(depth) + el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + cls + (text ? ' :: ' + text : ''));
    const seen = new Map();
    for (const k of kids) {
      const sig = k.tagName + '.' + (typeof k.className === 'string' ? k.className.trim().split(/\\s+/).slice(0,3).join('.') : '');
      const n = (seen.get(sig)||0)+1; seen.set(sig,n);
      if (n > 2) continue;
      walk(k, depth+1);
    }
  }
  walk(document.body, 0);
  return lines.join('\\n');
})()`;

const links = `(() => {
  const out = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    const h = (a.getAttribute('href')||'').replace(/^https?:\\/\\/[^/]+/,'');
    if (!h || h.startsWith('javascript:') || h.startsWith('#')) continue;
    const key = h.split('?')[0];
    if (!out.has(key)) out.set(key, (a.title || a.textContent || '').trim().slice(0,60));
  }
  return [...out.entries()].slice(0, 300);
})()`;

async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
}

await send('Page.enable'); await send('Runtime.enable');
await fs.mkdir(OUT, { recursive: true });
const urls = process.argv.slice(2);
for (const url of urls) {
  const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 90) || 'page';
  await send('Page.navigate', { url });
  // wait for load event then settle
  await sleep(Number(process.env.WAIT_MS || 7000));
  const info = await evalJs('({url:location.href,title:document.title,ready:document.readyState,h:document.documentElement.scrollHeight})');
  const ol = await evalJs(outline);
  const lk = await evalJs(links);
  await fs.writeFile(`${OUT}/${slug}.json`, JSON.stringify({ url, info, links: lk }, null, 2));
  await fs.writeFile(`${OUT}/${slug}.outline.txt`, ol || '');
  const m = await send('Page.getLayoutMetrics');
  const cs = m.cssContentSize || m.contentSize;
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: Math.min(cs.width, 1600), height: Math.min(cs.height, 16000), scale: 0.6 }, captureBeyondViewport: true });
  await fs.writeFile(`${OUT}/${slug}.png`, Buffer.from(shot.data, 'base64'));
  console.log(url, '->', info.url, info.title?.slice(0, 50), 'links:', lk?.length, 'outline:', (ol||'').split('\n').length);
}
ws.close();
