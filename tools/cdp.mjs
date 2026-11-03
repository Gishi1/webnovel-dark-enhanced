#!/usr/bin/env node
// Minimal CDP driver for local development. Not shipped in the extension.
// usage:
//   node tools/cdp.mjs eval <js-file-or-"-">        (evaluate in page, print JSON result)
//   node tools/cdp.mjs goto <url>
//   node tools/cdp.mjs shot <out.png> [full]
//   node tools/cdp.mjs info
const PORT = process.env.CDP_PORT || '9223';

async function targets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return (await r.json()).filter(t => t.type === 'page');
}

async function pageTarget() {
  const list = await targets();
  if (process.env.CDP_TARGET) {
    const t = list.find(t => t.id === process.env.CDP_TARGET);
    if (!t) throw new Error('target not found');
    return t;
  }
  const t = list.find(t => t.url.includes('webnovel.com')) || list[0];
  if (!t) throw new Error('no page target');
  return t;
}

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res; this.ws.onerror = e => rej(new Error('ws error'));
    });
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  close() { try { this.ws.close(); } catch {} }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const t = await pageTarget();
  const c = new CDP(t.webSocketDebuggerUrl);
  await c.open();
  await c.send('Page.enable');
  await c.send('Runtime.enable').catch(() => {});
  try {
    if (cmd === 'eval') {
      const fs = await import('node:fs/promises');
      const src = args[0] === '-' ? await new Promise(r => { let d=''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => r(d)); }) : await fs.readFile(args[0], 'utf8');
      const r = await c.send('Runtime.evaluate', { expression: src, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) { console.error('EXCEPTION', JSON.stringify(r.exceptionDetails, null, 2)); process.exitCode = 1; }
      else console.log(JSON.stringify(r.result.value ?? r.result, null, 2));
    } else if (cmd === 'goto') {
      await c.send('Page.navigate', { url: args[0] });
      await sleep(Number(process.env.WAIT_MS || 5000));
    } else if (cmd === 'shot') {
      const params = { format: 'png' };
      if (args[1] === 'full') {
        const m = await c.send('Page.getLayoutMetrics');
        const cs = m.cssContentSize || m.contentSize;
        params.clip = { x: 0, y: 0, width: cs.width, height: Math.min(cs.height, 20000), scale: 1 };
        params.captureBeyondViewport = true;
      }
      const r = await c.send('Page.captureScreenshot', params);
      await (await import('node:fs/promises')).writeFile(args[0], Buffer.from(r.data, 'base64'));
      console.log('wrote', args[0]);
    } else if (cmd === 'info') {
      const r = await c.send('Runtime.evaluate', { expression: '({url:location.href,title:document.title,ready:document.readyState,w:innerWidth,h:innerHeight})', returnByValue: true });
      console.log(JSON.stringify(r.result.value, null, 2));
    } else {
      console.error('unknown command'); process.exitCode = 2;
    }
  } finally { c.close(); }
}
main().catch(e => { console.error(e); process.exit(1); });
