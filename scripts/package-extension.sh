#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -p "require('$EXT_DIR/manifest.json').version")"
OUT_ZIP="$DIST_DIR/homenotes-chrome-v${VERSION}.zip"

mkdir -p "$DIST_DIR"
rm -f "$OUT_ZIP"

(
  cd "$EXT_DIR"
  zip -r "$OUT_ZIP" . -x "*.DS_Store" "*__MACOSX*" "*.map"
)

echo "Packaged: $OUT_ZIP"
unzip -l "$OUT_ZIP"
