#!/usr/bin/env bash
# The private DFW project supplies its installed adapter and synthetic fixture helper.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
export REVIEW_NATIVE_ROOT="${REVIEW_NATIVE_ROOT:-$(cd "$here/.." && pwd)}"
: "${REVIEW_PYTHON:?Set to the locked DFW environment Python}"
: "${REVIEW_DFW_PROJECT:?Set to the reviewed private DFW project root}"
export REVIEW_PYTHON REVIEW_DFW_PROJECT
"$REVIEW_NATIVE_ROOT/tests/with-disposable-pg.sh" node "$here/tests/cross-domain.mjs"
