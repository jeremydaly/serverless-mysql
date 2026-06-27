#!/usr/bin/env bash
# Bundle the Lambda handler with its dependencies into function.zip.
# `serverless-mysql` is installed from the parent repo (file:../..) so the
# benchmark always exercises the working-tree version of the library.
set -euo pipefail

cd "$(dirname "$0")/lambda"

rm -rf node_modules function.zip
# --install-links installs the local `serverless-mysql` (file:../..) as a real copy
# honoring its package `files` field, instead of symlinking the whole repo (which
# would otherwise pull .git + node_modules into the zip).
npm install --omit=dev --install-links --no-audit --no-fund

if ! command -v zip >/dev/null 2>&1; then
  echo "error: 'zip' is required to package the Lambda. Install it and re-run." >&2
  exit 1
fi

zip -qr function.zip handler.js node_modules
echo "Built $(pwd)/function.zip ($(du -h function.zip | cut -f1))"
