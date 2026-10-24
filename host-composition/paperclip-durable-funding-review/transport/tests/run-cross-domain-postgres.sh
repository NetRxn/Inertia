#!/usr/bin/env bash
# Public entry point; the installed private owning project supplies PG fixtures/fence.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
export REVIEW_NATIVE_ROOT="${REVIEW_NATIVE_ROOT:-$(cd "$here/.." && pwd)}"
: "${REVIEW_PYTHON:?Set to the locked DFW environment Python}"
: "${REVIEW_DFW_PROJECT:?Set to the reviewed private DFW project root}"
: "${PG_FIXTURE_ROOT:?Set to the privately prepared official PG/PostGIS package root}"
: "${QUALIFICATION_OUTPUT:?Set to an all-PostgreSQL qualification receipt directory}"
export QUALIFICATION_PYTHON="$REVIEW_PYTHON"
exec bash "$REVIEW_DFW_PROJECT/qualification/run-review-transport-postgres.sh"
