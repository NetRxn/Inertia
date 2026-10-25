#!/usr/bin/env bash
# Optional exact Task2 compatibility checkout may be supplied until Task2 merges.
set -euo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)
export REVIEW_NATIVE_ROOT="${REVIEW_NATIVE_ROOT:-$here}"
: "${REVIEW_PYTHON:?Set to the locked private project environment Python}"
: "${REVIEW_DFW_PROJECT:?Set to the reviewed private project root}"
: "${PG_FIXTURE_ROOT:?Set to the privately prepared official PostgreSQL/PostGIS root}"
: "${QUALIFICATION_OUTPUT:?Set to a disposable qualification receipt directory}"
export QUALIFICATION_PYTHON="$REVIEW_PYTHON"
exec bash "$REVIEW_DFW_PROJECT/qualification/run-member-transport-postgres.sh"
