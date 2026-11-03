#!/usr/bin/env bash
# Pull the latest code, report the version change and reload the unpacked
# extension. Requires a browser started with --remote-debugging-port for the
# reload step; otherwise it prints the manual steps.
set -euo pipefail
cd "$(dirname "$0")/.."

BEFORE="$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")"
git pull --ff-only
AFTER="$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")"
echo "WebNovel Dark & Enhanced: ${BEFORE} → ${AFTER}"

PORT="${CDP_PORT:-9225}"
if curl -sf -m 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  CDP_PORT="$PORT" node tools/reload-extension.mjs "$PORT"
else
  cat <<'MSG'
No debuggable browser found, so reload manually:
  1. open chrome://extensions (or brave://extensions)
  2. click Reload on WebNovel Dark & Enhanced
  3. refresh any open WebNovel tabs
MSG
fi
