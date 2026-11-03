#!/usr/bin/env node
// Reload the unpacked extension in the running browser via its service worker.
const PORT = process.env.CDP_PORT || '9225';
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const sw = list.find(t => t.type === 'service_worker' && t.url.includes('/src/background.js'));
if (!sw) { console.error('extension service worker not found'); process.exit(1); }
const ws = new WebSocket(sw.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'chrome.runtime.reload()' } }));
await new Promise(r => setTimeout(r, 800));
ws.close();
console.log('extension reload requested');
