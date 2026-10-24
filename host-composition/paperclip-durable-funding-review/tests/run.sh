#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec ./tests/with-disposable-pg.sh node --test "$@"
