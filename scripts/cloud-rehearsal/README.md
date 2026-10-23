# Disposable cloud qualification

This profile qualifies the **pinned official Paperclip native services**, current
Inertia worker and real PostgreSQL. It does not deploy a service, enroll a member,
issue credentials for ongoing access, run an LLM, submit a grant, or provide a
container/VPS isolation claim. Runtime companies remain disabled. Native task,
checkout, membership and review authority stay in Paperclip; no scheduler or CRM
is introduced. All user/agent/run rows are synthetic, local database fixtures.

## Reproduce

After the one-time preparation below, run the **whole cross-repository lane** with
one command:

    DFW_CHECKOUT=/path/to/DFW-Gov-Fund/government-funding-dfw \
    QUALIFICATION_PYTHON=/path/to/locked/python \
    PG_FIXTURE_ROOT=/path/to/prepared-postgres/root \
    bash scripts/cloud-rehearsal/run-integrated.sh

It runs the full-schema PostgreSQL/PostGIS domain tests and migration roundtrip,
the native Paperclip/crash-recovery lane, then the real PG export through official
embedded Helix. A nonzero exit and a failed receipt mean qualification did not
complete. Each lane owns cleanup; a failed cleanup retains its owned data and
reports why. Evidence directories are printed, not uploaded.

Prepare the domain database tools once with its checked-in script, not manual
package hunting:

    PG_PREPARATION_DIR=/new/empty/writable/directory \
      bash "$DFW_CHECKOUT/qualification/prepare-postgres.sh"

That Debian 13 amd64 profile verifies signed official indexes and exact package
hashes, extracts into user-owned storage, and never installs a system service.
Keep the printed PG_FIXTURE_ROOT. Other platforms need a separately qualified
profile rather than weakening these checks.

Prerequisites: Linux x64, Node >=24.11, repository dependencies and a successful
`node node_modules/typescript/bin/tsc`. Install these **separate locked tooling
dependencies** only in an authorized environment:

    cd scripts/cloud-rehearsal
    npm ci --ignore-scripts --no-audit --no-fund
    npm ci --prefix host --ignore-scripts --no-audit --no-fund
    (cd node_modules/@embedded-postgres/linux-x64 && node scripts/hydrate-symlinks.js)
    cd ../..
    node --test scripts/test/cloud-rehearsal.test.mjs
    node scripts/cloud-rehearsal/run.mjs

The launch itself performs **no downloads**. Paperclip is exactly 2026.1012.0;
PG is the registry-distributed native 18.1 binary, not PGlite. Lock integrity
fields bind the artifacts. The hydration step is the package's own library-link
helper, not a system installation. Root dependency locks remain unchanged.

The launcher rejects incoming database/PG connection overrides, owns a fresh
temporary data directory, uses a random in-memory fixture password with a
mode-0600 init file, SCRAM host authentication, IPv4 loopback only, an ephemeral
port and no Unix sockets. It uses a clean child environment, isolated HOME and
PAPERCLIP_HOME, disables heartbeat scheduling and announcements, and never
configures a provider. Each command has a three-minute bound. Start and restart
use the same explicit binding options. It stops PostgreSQL and removes its owned
workspace on success or ordinary errors; sanitized logs remain under ignored
`runs-cloud-rehearsal-*`. If shutdown itself fails, it fails rather than deleting
a potentially active cluster. An uncatchable host/process kill is outside this
cleanup guarantee; use disposable executor teardown for that case.

The plugin is loaded from a fresh copy of built runtime files, with existing
checkout dependencies reused. This is **not** a fresh production-only dependency
installation. Use the existing `scripts/verify-package.mjs` gate separately.
The checked-in tools/host locks are not part of the runtime npm tarball.

## Assertions and boundaries

- Native worker activation, six plugin migrations, three disabled native jobs,
  validation/health, native SQL parameter binding and company isolation.
- Actual host human attribution; viewer and revoked membership refusal.
- Actual native issue creation and two synthetic agents contending for checkout:
  one winner, duplicate convergence, wrong-run/wrong-holder refusal, native
  release after a terminal failed run, takeover, stale-holder refusal, terminated
  agent refusal and cross-company refusal. The failed executor is represented by
  a terminal authoritative run row. **No second physical member runner executes.**
- Real PostgreSQL simultaneous inbox/outbox/publication claims, one winner,
  unrelated identity collisions fail closed; read/write fixture role cannot read
  host company tables, delete outbox state, or modify pairings.
- Immediate PG shutdown and restart, persisted native result and signed-event
  identity, explicit recovery after prior process termination, stale publication
  token refusal, revocation/suppression and anti-resurrection.

These checks cannot qualify production routing, host HTTP/UI, external relays,
SSO, real identity admission, runtime data distribution, remote Helix durability,
or PPC2's actual container/lease/sync implementation. On this cloud executor,
unmodified `os.networkInterfaces()` fails with `uv_interface_addresses`; the
pinned full HTTP host uses it. No shim or security relaxation is applied.

## Composition ports

- Domain PG+PostGIS tests run separately against their own disposable full-schema
  database. Their owning-service export is passed to
  `scripts/qualify-partner-wire.mjs`; embedded Helix is an official engine test,
  not a remote gateway or failover claim.
- Native funding-review adapters must bring their own authenticated host binding,
  revision serialization, outcome-reconciliation and audit receipts. This harness
  does not implicitly activate a new adapter or accept a proposal.
- Bounty/objective and brief artifacts remain private proposals until their
  respective reviewed admission hooks pass. No fixture grants external authority.

## Deployment admission remains separate

Existing execution infrastructure, not this test harness, must enforce non-root,
read-only root, network-none workloads, dropped capabilities, no-new-privileges,
resource bounds, per-workspace isolation, current authorization and fenced
execution/recovery receipts. Require immutable digest-bound images/catalog,
reviewed ingress/egress capability admission and the infrastructure's own current
release gates before activation. This public adapter copies no private execution
implementation. Do not label this profile or its passing receipt production-ready.

Sources: official packages locked here; native API implementation shipped in
`paperclipai@2026.1012.0`; https://github.com/paperclipai/paperclip/releases/tag/v2026.1012.0;
https://github.com/leinelissen/embedded-postgres .

## Short deployment/update handoff

1. Run the integrated command and the existing package gate. Preserve source,
   lock and runtime-tarball hashes with the passing receipts.
2. In an admitted cloud executor with normal network-interface enumeration and
   the existing execution substrate, rerun full host HTTP and isolated member
   runner qualification. This workspace has neither Docker nor a saved cloud
   environment; the native-service pass is not a substitute.
3. Hand the exact runtime tarball to the existing admitted Paperclip plugin
   installation flow. Keep companies disabled until current identity, capability,
   ingress/egress and execution-profile admission passes. Live activation is a
   separate authorized task.
4. Check newer stable releases using `node scripts/paperclip-upgrade.mjs --dry-run`.
   Use its existing isolated `--qualify` path when authorized; never edit installed
   production dependencies in place. For promotion, update the exact tooling locks
   and expected tested host version together, rerun native/full HTTP/package and
   execution qualifications, preserve the previous exact artifact for rollback,
   and promote only the newly approved distribution. The pinned baseline is
   reproducible evidence, not a permanent ban on updates.
