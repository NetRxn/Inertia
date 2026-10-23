#!/usr/bin/env bash
# One command after the explicitly documented, locked tooling preparation.
set -euo pipefail
: "${DFW_CHECKOUT:?Set DFW_CHECKOUT to government-funding-dfw application directory}"
: "${QUALIFICATION_PYTHON:?Set QUALIFICATION_PYTHON to its locked Python environment}"
: "${PG_FIXTURE_ROOT:?Set PG_FIXTURE_ROOT to prepare-postgres.sh output root}"
root=$(cd "$(dirname "$0")/../.." && pwd)
dfw=$(cd "$DFW_CHECKOUT" && pwd)
test -f "$dfw/qualification/run-real-postgres.sh"
test -f "$root/dist/src/store/postgres.js"
output=$(mktemp -d "$root/runs-cloud-rehearsal-integrated-XXXXXXXX")
finish() {
  code=$?
  if [ "$code" -eq 0 ]; then result=passed; else result=failed; fi
  printf '{"result":"%s","productionReady":false,"fullHttp":false,"ppc2Container":false}\n' "$result" > "$output/receipt.json"
  printf 'Integrated rehearsal %s. Evidence: %s\n' "$result" "$output"
}
trap finish EXIT
env -u DFW_CHECKOUT QUALIFICATION_OUTPUT="$output/domain" bash "$dfw/qualification/run-real-postgres.sh" > "$output/domain-driver.log" 2>&1
node "$root/scripts/cloud-rehearsal/run.mjs" > "$output/native-driver.log" 2>&1
node "$root/scripts/qualify-partner-wire.mjs" "$output/domain/postgres-wire.json" > "$output/helix-wire.json"
