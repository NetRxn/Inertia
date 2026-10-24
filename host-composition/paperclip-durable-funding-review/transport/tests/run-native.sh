#!/usr/bin/env bash
# Run with the already bootstrapped, fingerprint-qualified parent native bundle.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
export REVIEW_NATIVE_ROOT="${REVIEW_NATIVE_ROOT:-$(cd "$here/.." && pwd)}"
"$REVIEW_NATIVE_ROOT/tests/with-disposable-pg.sh" node --test "$here/tests/native-routes.test.mjs" "$here/tests/host-composition.test.mjs"
node --test "$here/tests/reconcile.test.mjs" "$here/tests/resource-bounds.test.mjs"
