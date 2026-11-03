#!/usr/bin/env bash
# Build the Chrome Web Store / GitHub release zip.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")"
OUT="dist/webnovel-dark-enhanced-${VERSION}.zip"
mkdir -p dist
rm -f "$OUT"
zip -r -q "$OUT" manifest.json src icons README.md LICENSE CHANGELOG.md
echo "built $OUT"
python3 - "$OUT" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    print(len(z.namelist()), "files")
PY
