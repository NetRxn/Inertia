# Inertia native-service cloud qualification

Verified 2026-10-23 on Node 24.19.0, Linux x64.

## Result

The official `paperclipai@2026.1012.0` release contains build commit `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`. The actual release's plugin loader, PostgreSQL migration service, worker manager, host RPC handlers, lifecycle, registry and job registration were exercised against a disposable PostgreSQL 18.1 database. No substitute host implementation was used.

- Paperclip applied 304 native migrations to an empty database.
- Inertia `@inertia/dao-helper@0.1.0` registered as `netrxn.inertia`.
- All four plugin migrations applied; the eight expected tables exist under `plugin_netrxn_inertia_e936d62b87`.
- Actual worker process started and initialized. Three jobs registered: backfill-conversations, retry-blocked-deliveries, reconcile.
- Synthetic company configs remained `{ "enabled": false }`.
- Native worker `validateConfig` returned `{ "ok": true }`.
- Native worker health returned `degraded`, “Enable a company connection to begin.” This is the correct disabled-connection state.
- Re-activation preserved the four migration ledger entries. Duplicate install returned the expected HTTP-style 409 conflict.
- Worker shutdown completed with exit code 0; PostgreSQL shut down cleanly.

Plugin tarball SHA256: `5da7342496f12d6f43e9944bfb7b390df4b2f17f67f78ced2ab4649862d921fa`.

## Full-host boundary and exact blocker

The unmodified pinned HTTP host reached successful database migration and app construction, then failed before listening:

```
SystemError [ERR_SYSTEM_ERROR]: uv_interface_addresses returned Unknown system error 1
  at Object.networkInterfaces (node:os)
  at collectReachableInterfaceHosts (server/dist/runtime-api.js:69)
  at buildRuntimeApiCandidateUrls (server/dist/runtime-api.js:127)
  at startServerWithDatabaseTeardown (server/dist/index.js:728)
```

This cloud sandbox disallows network-interface enumeration. The pinned source calls it unconditionally, including with loopback binding and an explicit API URL. No monkeypatch, interface-enumeration shim, host-security change, or bypass was used. This restriction applies to the cloud sandbox. The subsequent authorized isolated Docker fallback passed HTTP/API health, synthetic company creation, plugin install/configuration/health and jobs without source changes. Its [separate receipt](docker-http-receipt.json) pins source commit, official images and runtime versions. The Docker package is identified by its recorded source build; the earlier delivered tarball retains its separate SHA-bound qualification. Browser UI and end-to-end live service connections remain separate checks.

The default embedded bootstrap also uses a broad address port detector that loops in this sandbox. The official PostgreSQL binaries work through TCP-only localhost; filesystem Unix sockets are unavailable here. Native package symlinks were hydrated using the package's own postinstall script. No system libraries or system services were installed.

## Reproduce with the committed harness

Use Node 24.19.0 and an authorized disposable PostgreSQL 18.1 database. Start in a new scratch directory, copy [qualify-runtime.mjs](qualify-runtime.mjs) into it, and place the verified runtime archive there. The commands below reproduce the evaluated host release; retain the generated lockfile when repeating an exact dependency installation. The harness reads its host version from installed package metadata, so later qualified candidates need no manual source edit. Package integrity and build identity establish provenance, rather than metadata shape alone.

```sh
printf '%s\n' '{"private":true,"type":"module"}' > package.json
npm install --save-exact --omit=dev --ignore-scripts --no-audit --no-fund paperclipai@2026.1012.0
mkdir plugin
tar -xzf inertia-dao-helper-0.1.0.tgz --strip-components=1 -C plugin
(cd plugin && npm install --omit=dev --ignore-scripts --no-audit --no-fund)
mkdir isolated-home
export HOME="$PWD/isolated-home"
export PAPERCLIP_HOME="$HOME/.paperclip"
# Set this to an authorized disposable database, never production.
export QUALIFICATION_DATABASE_URL='postgres://USER@127.0.0.1:PORT/DISPOSABLE_DATABASE'
node --input-type=module -e "import {applyPendingMigrations} from '@paperclipai/db'; await applyPendingMigrations(process.env.QUALIFICATION_DATABASE_URL)"
node qualify-runtime.mjs
```

Verify four plugin migrations, eight namespace tables, three registered jobs, successful configuration validation, and the expected disabled health message. Run the harness again against the same disposable database to check activation and migration stability. The harness shuts down workers; stop the disposable database afterward. Keep generated local keys, database contents and connection credentials out of receipts and source control. This procedure uses native services and does not modify the host to bypass the HTTP startup restriction.

## Full-host fallback procedure

Use the same pinned package and an ordinary authorized cloud/container environment where `os.networkInterfaces()` is permitted. Supply an isolated config: local_trusted/private, bind loopback, host 127.0.0.1, serveUi false, telemetry false, updates disabled, and a disposable database. Set `PAPERCLIP_MIGRATION_AUTO_APPLY=true`, `PAPERCLIP_ANNOUNCEMENTS_ENABLED=false`, `HEARTBEAT_SCHEDULER_ENABLED=false`, then run `node node_modules/@paperclipai/server/dist/index.js`.

Verify `/api/health`, install the same local plugin through `POST /api/plugins/install`, set disabled company config, and check `/api/plugins/:pluginId/health`. The authorized Docker fallback completed that HTTP/API check on the same baseline after the cloud restriction. Cloud-first remains the default; laptop use is reserved for a specific authorized fallback.

## Evidence

The [machine-readable receipt](native-services-receipt.json) records pinned versions, migration/table/job counts, worker validation/health and shutdown results. The archive SHA256 above matches the separately delivered 0.1.0 runtime package.

No live Buzz relay, Drive, website publisher, blockchain, grant submission, human account or private execution-provider code was involved.
