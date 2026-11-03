#!/usr/bin/env bash
# Restart the Brave test browser with the unpacked extension. Dev tool only.
set -u
PORT=9225
PROFILE=/tmp/wn-brave-prof
EXT="$(cd "$(dirname "$0")/.." && pwd)"
node "$(dirname "$0")/close-browser.mjs" >/dev/null 2>&1 || true
python3 - "$PORT" "$PROFILE" <<'PY'
import os, signal, sys
port, profile = sys.argv[1], sys.argv[2]
me, parent = os.getpid(), os.getppid()
for pid in os.listdir('/proc'):
    if not pid.isdigit():
        continue
    p = int(pid)
    if p in (me, parent):
        continue
    try:
        exe = os.readlink(f'/proc/{pid}/exe')
        cmd = open(f'/proc/{pid}/cmdline', 'rb').read().replace(b'\0', b' ').decode('utf8', 'ignore')
    except Exception:
        continue
    if 'brave' in os.path.basename(exe) and profile in cmd and f'remote-debugging-port={port}' in cmd:
        try:
            os.kill(p, signal.SIGTERM)
        except Exception:
            pass
PY
sleep 2
if [ "${WNE_CLEAN:-0}" = "1" ]; then rm -rf "$PROFILE"; fi
mkdir -p "$PROFILE/Default"
# Chrome disables unpacked extensions on reload when Developer mode is off.
python3 - "$PROFILE/Default/Preferences" <<'PY'
import json, os, sys
path = sys.argv[1]
data = {}
if os.path.exists(path):
    try:
        data = json.load(open(path))
    except Exception:
        data = {}
data.setdefault('extensions', {}).setdefault('ui', {})['developer_mode'] = True
json.dump(data, open(path, 'w'))
PY
DISPLAY=:99 nohup brave --no-sandbox --no-first-run --no-default-browser-check --disable-gpu \
  --disable-dev-shm-usage --remote-debugging-port="$PORT" --user-data-dir="$PROFILE" --window-size=1500,2400 \
  --load-extension="$EXT" --disable-extensions-except="$EXT" \
  --disable-blink-features=AutomationControlled --lang=en-US "${1:-https://www.webnovel.com/stories}" \
  > /tmp/brave-ext.log 2>&1 &
sleep 12
curl -s "http://127.0.0.1:$PORT/json/version" | head -c 60
echo
