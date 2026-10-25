#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PUBLIC=${QUALIFICATION_PUBLIC_ROOT:-$(cd "$HERE/../.." && pwd)}
: "${QUALIFICATION_PRIVATE_ROOT:?Set the local government-funding-dfw checkout path}"
: "${QUALIFICATION_PYTHON:?Set the preinstalled DFW Python interpreter path}"
export QUALIFICATION_PUBLIC_ROOT="$PUBLIC"
export QUALIFICATION_OUTPUT_DIR=${QUALIFICATION_OUTPUT_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/inertia-drafting-qualification.XXXXXXXX")}
mkdir -p "$QUALIFICATION_OUTPUT_DIR"
node "$PUBLIC/node_modules/typescript/bin/tsc" --project "$PUBLIC/tsconfig.json" --outDir "$QUALIFICATION_OUTPUT_DIR/build"
node "$HERE/qualify.mjs"
