#!/usr/bin/env bash
# Synthetic qualification only. Reject all inherited database routing/auth.
set -euo pipefail
umask 077
for variable in $(compgen -e); do
  case "$variable" in
    PG*|DFW_*|NATIVE_CAPTURE_DATABASE_URL|NATIVE_CAPTURE_FIXTURE_ROOT)
      printf 'Refusing inherited database environment variable: %s\n' "$variable" >&2; exit 2 ;;
  esac
done
cd "$(dirname "$0")/.."
BIN=$(node scripts/verify-pg.mjs)
work=$(mktemp -d "${TMPDIR:-/tmp}/native-pg-qualification.XXXXXXXX")
output="$PWD/logs/$(basename "$work")"
mkdir -p "$output"
attempted=false
cleanup() {
  rc=$?
  trap - EXIT
  if ! python3 tests/cleanup_cluster.py "$work" "$BIN/postgres" "$attempted" "$output/cluster-cleanup.json" > "$output/cleanup.log"; then rc=1; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 -c 'import secrets; print(secrets.token_hex(32))' > "$work/password"
"$BIN/initdb" -D "$work/db" -U fixture --auth=scram-sha-256 --pwfile="$work/password" --encoding=UTF8 --locale=C > "$output/initdb.log"
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
attempted=true
"$BIN/pg_ctl" -D "$work/db" -l "$output/postgres.log" -o "-h 127.0.0.1 -p $port -c unix_socket_directories='' -c timezone=UTC -c statement_timeout=30000 -c lock_timeout=10000" -w -t 30 start > "$output/start.log"
export NATIVE_CAPTURE_DATABASE_URL="postgres://fixture:$(cat "$work/password")@127.0.0.1:$port/postgres"
export NATIVE_CAPTURE_FIXTURE_ROOT="$work"
node tests/setup.mjs > "$output/migrations.log" 2>&1
node tests/install-qualification.mjs
"$@"
