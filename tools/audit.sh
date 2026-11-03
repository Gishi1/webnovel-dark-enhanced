#!/usr/bin/env bash
# Audit the extension against every supported page type.
#   WNE_CLEAN=1 ./tools/audit.sh    # restart the test browser first
# Requires the unpacked extension loaded in the browser on CDP_PORT (default 9225).
set -u
cd "$(dirname "$0")/.."
PORT="${CDP_PORT:-9225}"
OUT="${AUDIT_DIR:-/tmp/wn-audit}"
WAIT="${AUDIT_WAIT:-8000}"
mkdir -p "$OUT"

if [ "${WNE_CLEAN:-0}" = "1" ]; then
  WNE_CLEAN=1 ./tools/restart-browser.sh >/dev/null 2>&1
fi

PAGES=(
  "home|https://www.webnovel.com/"
  "stories|https://www.webnovel.com/stories"
  "tags|https://www.webnovel.com/tags/action-novel"
  "search|https://www.webnovel.com/search?q=shadow"
  "ranking|https://www.webnovel.com/ranking/hot"
  "catalog|https://www.webnovel.com/book/22196546206090805/catalog"
  "book|https://www.webnovel.com/book/shadow-slave_22196546206090805"
  "reader|https://www.webnovel.com/book/shadow-slave_22196546206090805/nightmare-begins_59583457017254387"
  "library|https://www.webnovel.com/library"
  "accounts|https://www.webnovel.com/accounts"
)

fail=0
printf '%-10s %-8s %-8s %-16s %5s %4s %4s %5s %5s\n' PAGE READY THEME BG CARDS GRID BAR WHITE ERRORS
for entry in "${PAGES[@]}"; do
  name="${entry%%|*}"
  url="${entry#*|}"
  json="$OUT/$name.json"
  CDP_PORT="$PORT" node tools/verify.mjs "$url" tools/audit-check.js "$OUT/$name.png" "$WAIT" > "$json" 2>&1
  python3 - "$name" "$json" <<'PY'
import json, sys
name, path = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path))
except Exception:
    print(f"{name:10} FAILED (unparsable output)")
    raise SystemExit(1)
c = data.get('checks') or {}
ext = [l for l in data.get('logs', []) if l.get('kind') == 'exception' and 'chrome-extension' in str(l.get('url', ''))]
print(
    f"{name:10} {str(c.get('ready')):8} {str(c.get('theme')):8} {str(c.get('bodyBg')):16} "
    f"{c.get('cards', 0):5} {int(bool(c.get('grid'))):4} {int(bool(c.get('filterBar'))):4} "
    f"{c.get('whitePanels', 0):5} {len(ext):5}"
)
if c.get('ready') != '1' or ext:
    raise SystemExit(1)
PY
  [ $? -ne 0 ] && fail=1
done

# Enhanced table of contents on a chapter page.
TOC_JSON="$OUT/toc.json"
CDP_PORT="$PORT" node tools/verify.mjs \
  "https://www.webnovel.com/book/shadow-slave_22196546206090805/nightmare-begins_59583457017254387" \
  tools/audit-toc.js "$OUT/toc.png" "$WAIT" > "$TOC_JSON" 2>&1
python3 - "$TOC_JSON" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    print("toc        FAILED (no output)")
    raise SystemExit(1)
c = data.get('checks') or {}
ok = c.get('items', 0) > 0 and not c.get('error')
print(
    f"toc        {'ok' if ok else 'FAIL':8} items={c.get('items', 0):5} "
    f"volumes={c.get('volumes', 0):3} current={'yes' if c.get('current') else 'no'}"
)
raise SystemExit(0 if ok else 1)
PY
[ $? -ne 0 ] && fail=1

exit $fail
