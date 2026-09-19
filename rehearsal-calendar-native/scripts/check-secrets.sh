#!/bin/bash
# Keep the historical command while the scanner uses one regex/path dialect.
set -u

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '{"path":null,"line":0,"rule":"scan-error","code":"NODE_UNAVAILABLE"}'
  printf '%s\n' '{"summary":"error","mode":"unknown","files":0,"findings":0,"errors":1}'
  exit 2
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" 2>/dev/null && pwd)
if [ -z "$SCRIPT_DIR" ]; then
  printf '%s\n' '{"path":null,"line":0,"rule":"scan-error","code":"SCANNER_DIRECTORY_UNAVAILABLE"}'
  printf '%s\n' '{"summary":"error","mode":"unknown","files":0,"findings":0,"errors":1}'
  exit 2
fi

exec node "$SCRIPT_DIR/check-secrets.mjs" "$@"
