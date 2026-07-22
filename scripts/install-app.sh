#!/usr/bin/env bash
# Bundle Actionable and (re)install it into /Applications, replacing any
# existing copy. Quits a running instance first and relaunches at the end.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="Actionable"
APP_PATH="/Applications/${APP_NAME}.app"

echo "==> Building main, preload and renderer bundles"
npm run build

# The app ships without node_modules, so the main and preload bundles must be
# self-contained: only electron and node builtins may be required at runtime.
echo "==> Checking bundles are self-contained"
BUILTINS="$(node -p "require('node:module').builtinModules.join('|')")"
EXTERNALS="$(grep -ohE 'require\("[^"]+"\)' out/main/index.js out/preload/index.js \
  | sed -E 's/require\("([^"]+)"\)/\1/' | sort -u \
  | grep -vE '^node:' | grep -vx 'electron' \
  | grep -vxE "(${BUILTINS})" || true)"
if [ -n "${EXTERNALS}" ]; then
  echo "error: unbundled runtime dependencies in out/ (move them to devDependencies so electron-vite bundles them):" >&2
  echo "${EXTERNALS}" >&2
  exit 1
fi

echo "==> Packaging ${APP_NAME}.app"
npx electron-builder --mac --dir

BUILT_APP="$(find dist -maxdepth 2 -name "${APP_NAME}.app" -type d | head -1)"
if [ -z "${BUILT_APP}" ]; then
  echo "error: ${APP_NAME}.app not found under dist/" >&2
  exit 1
fi

if pgrep -xq "${APP_NAME}"; then
  echo "==> Quitting running ${APP_NAME}"
  # A real Quit event, so the app shuts the scheduler down and closes the
  # database cleanly (window close alone only hides the window).
  osascript -e "quit app \"${APP_NAME}\"" || true
  for _ in $(seq 1 20); do
    pgrep -xq "${APP_NAME}" || break
    sleep 0.5
  done
  if pgrep -xq "${APP_NAME}"; then
    echo "==> Still running, force killing"
    pkill -x "${APP_NAME}" || true
    sleep 1
  fi
fi

echo "==> Installing to ${APP_PATH}"
rm -rf "${APP_PATH}"
ditto "${BUILT_APP}" "${APP_PATH}"

# Ad-hoc sign the installed copy so macOS UNNotification API accepts it.
echo "==> Ad-hoc signing"
codesign --force --deep --sign - "${APP_PATH}"

echo "==> Launching"
open "${APP_PATH}"

VERSION="$(defaults read "${APP_PATH}/Contents/Info" CFBundleShortVersionString)"
echo "Installed ${APP_NAME} ${VERSION} at ${APP_PATH}"
echo "Data lives in ~/Library/Application Support/${APP_NAME}/actionable.db"
