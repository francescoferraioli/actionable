#!/usr/bin/env bash
# Electron 42+ uses macOS UNNotification, which rejects linker-signed binaries.
# Ad-hoc sign the dev Electron.app so local notifications work.
set -euo pipefail

ELECTRON_BIN="$(node -p "require('electron')")"
ELECTRON_APP="$(dirname "$(dirname "$(dirname "${ELECTRON_BIN}")")")"

if [ ! -d "${ELECTRON_APP}" ]; then
  echo "sign-electron: Electron.app not found at ${ELECTRON_APP}, skipping" >&2
  exit 0
fi

echo "==> Ad-hoc signing dev Electron.app for macOS notifications"
codesign --force --deep --sign - "${ELECTRON_APP}"
