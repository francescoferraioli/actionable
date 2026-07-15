#!/usr/bin/env bash
# Regenerate build/icon.png and build/icon.icns from the Swift source.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Rendering icon.png"
swift scripts/generate-icon.swift

SRC="build/icon.png"
ICONSET="$(mktemp -d)/Actionable.iconset"
mkdir -p "$ICONSET"

echo "==> Building icon.icns"
for entry in \
  "icon_16x16.png:16" \
  "icon_16x16@2x.png:32" \
  "icon_32x32.png:32" \
  "icon_32x32@2x.png:64" \
  "icon_128x128.png:128" \
  "icon_128x128@2x.png:256" \
  "icon_256x256.png:256" \
  "icon_256x256@2x.png:512" \
  "icon_512x512.png:512" \
  "icon_512x512@2x.png:1024"
do
  name="${entry%%:*}"
  size="${entry##*:}"
  sips -z "$size" "$size" "$SRC" --out "$ICONSET/$name" >/dev/null
done

iconutil -c icns "$ICONSET" -o build/icon.icns
rm -rf "$(dirname "$ICONSET")"
echo "Wrote build/icon.png and build/icon.icns"
