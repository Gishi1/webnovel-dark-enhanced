#!/usr/bin/env node
// Close the test browser through CDP (works even when /proc is not readable).
const PORT = process.env.CDP_PORT || '9225';
try {
  const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  await new Promise(r => setTimeout(r, 1200));
  try { ws.close(); } catch {}
  console.log('closed browser on', PORT);
} catch (e) {
  console.log('no browser on', PORT);
}
