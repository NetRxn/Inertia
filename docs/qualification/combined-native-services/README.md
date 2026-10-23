# Combined native-plugin qualification

On 2026-10-23 the exact combined tarball SHA256 `19e67c88a8de52404412e49312cebfd6db42c462de3378cf3397966250add76c` passed against unmodified official Paperclip `2026.1012.0` native services and disposable PostgreSQL 18.1. Source tree: `8039b3e5f54e49c302b4751445f382403381ab91`.

Six plugin migrations, eight namespace tables, installation, worker initialization, three disabled-company job RPCs, configuration validation, expected disabled health, lifecycle disable, worker exit 0 and PostgreSQL shutdown all passed. Actual host database binding checks cover empty/single/multiple IDs, quoted IDs, company isolation and validation-scan timestamp updates across all four affected methods.

This detected and then verified the fix for a real regression: the previous artifact's JavaScript array parameter became `ANY(()::text[])` inside the official host binder. Its reconcile job caught the error, so RPC success alone did not establish correctness. The new checks assert health as well as actual database effects. `failed-receipt.json` records that superseded artifact, not the passing one.

## Scope

Native services only, not HTTP host routes, browser UI, live relay, website publisher, production secrets, or a deployment. The known cloud `os.networkInterfaces()` full-host limitation was not bypassed or retried. Only synthetic company data and disposable localhost PostgreSQL were used. No host patch. Raw dependency logs and disposable database/signing material are intentionally excluded.

## Reproduce

Use a fresh disposable working directory. Copy `qualify-runtime.mjs` and `check-host-binding.mjs` into it. Copy the included `host/package.json` and `host/package-lock.json` into the same fresh directory, then run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`. The exact captured lock selects official `paperclipai@2026.1012.0` and its recorded dependencies; do not regenerate it for this reproduction. The expected lock SHA256 is `07f8491888d9afd91f207118fa69757777d9c837de8f2ad18c539a7e73d200f8`. This is an evaluation baseline, not a permanent version policy. Qualify newer stable releases through the existing upgrade process rather than changing this historical lock. Verify installed version and host build commit `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`.

Extract the verified tarball into `plugin/` using `tar -xzf ARTIFACT --strip-components=1 -C plugin`. Install its production dependencies with `npm install --omit=dev --ignore-scripts --no-audit --no-fund` from that directory. The recorded run reused the existing verified dependency trees and asserted exact direct dependency versions, not a new dependency installation.

Run the following in one shell invocation so the disposable server remains in the same process environment:

```sh
set -eu
P="$PWD/node_modules/@embedded-postgres/linux-x64/native"
(cd node_modules/@embedded-postgres/linux-x64 && node scripts/hydrate-symlinks.js)
export LD_LIBRARY_PATH="$P/lib"
export HOME="$PWD/home" PAPERCLIP_HOME="$PWD/home/paperclip"
export PAPERCLIP_ANNOUNCEMENTS_ENABLED=false HEARTBEAT_SCHEDULER_ENABLED=false
mkdir -p "$HOME"
"$P/bin/initdb" -D "$PWD/db" -U paperclip --auth=trust --encoding=UTF8 --locale=C
"$P/bin/pg_ctl" -D "$PWD/db" -o "-h 127.0.0.1 -p 55491 -c unix_socket_directories=''" -l "$PWD/pg.log" start
trap '"$P/bin/pg_ctl" -D "$PWD/db" stop' EXIT
node --input-type=module -e "import postgres from 'postgres'; const s=postgres('postgres://paperclip@127.0.0.1:55491/postgres');await s.unsafe('create database paperclip');await s.end();"
export QUALIFICATION_DATABASE_URL=postgres://paperclip@127.0.0.1:55491/paperclip
node --input-type=module -e "import {applyPendingMigrations} from '@paperclipai/db';await applyPendingMigrations(process.env.QUALIFICATION_DATABASE_URL);"
node qualify-runtime.mjs
```

Trust authentication here is only for a disposable synthetic localhost-only test, never a deployment recommendation. Do not run against an existing production database. Check `QUALIFICATION_ASSERTIONS_PASSED`, the worker's exit code, and PostgreSQL stop result. The sanitized log and machine-readable receipt record the actual successful run.
