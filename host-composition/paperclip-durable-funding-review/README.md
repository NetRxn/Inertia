# Native durable funding acceptance: non-live candidate

This is an isolated qualification of a trusted Paperclip host extension. It is not deployed, not a plugin SDK feature, and not connected to a real funding service. It adds no review UI, grant-submission route, new task table, or second approval/effect ledger.

## Pinned base

- @paperclipai/server, db, shared and plugin-sdk: 2026.1012.0.
- Server build commit: bba6a45f0d364cfd962ac59b3bdf2426a8222adb.
- This is a reproducible source baseline, not a permanent version policy or a claim that this is the latest release. See UPGRADE.md.
- Bootstrap fetches official public npm packages using package-lock.json integrity. No upstream distribution, credentials or private dependency code is vendored.
- Prerequisites: Linux x64, Node24.11+, npm, Python3 with Linux pidfd support, and GNU patch. No global service or production database is used.
- Run npm run bootstrap to install locked packages without dependency install scripts, verify exact upstream source/build fingerprints, apply the narrow patch with zero fuzz, hydrate the fingerprint-verified local PostgreSQL dependency, and verify the resulting candidate. It never starts Paperclip or configures production routes.
- npm run verify-and-patch repeats verification idempotently on already-installed local packages. External symlinked host/native packages are rejected for mutation.
- Run npm test and npm run test:launcher for qualification. Existing NATIVE_PG_BIN is allowed only if its three executable fingerprints match the qualified official dependency.
- patches/pinned-files.json records original and candidate SHA256 for changed/new files.
- patches/paperclip-2026.1012.0-durable-capture.patch applies relative to the pinned @paperclipai/server package root. It does not wire production routes or include retention SQL.

## Exact acceptance boundary

The actual native submitItemVerdicts transaction invokes a construction-time trusted capture hook only for newly resolved items. A captured command and its native item verdict commit or roll back together. Defer produces no command. Retries, complete cards and previously resolved items never retrospectively mint acceptance. Native legacy result fields remain untouched.

Capture checks the immutable registered card digest, exact document revision/link, current open issue/active company, authenticated human identity, current active non-viewer membership, and a configured funding-role permission grant with exact applicant and source scope. Native membership is not treated as a funding reviewer role. Existing principal_permission_grants rows are locked; permission keys and their meaning are injected by the host, not request or plugin data. No permissions are provisioned by capture.

All relevant locks are in the native transaction; a 2-second lock timeout bounds contention/deadlock failure before commit. Nested transaction composition is rejected, because publishing after a savepoint is not publishing after the outer commit. There is no network call, DFW write, or cross-database fence inside capture.

Once committed, the accepted snapshot survives later native document changes, withdrawal of remaining items, or membership/role revocation. DFW must still enforce its own current funding head/evidence/domain gates, exact command deduplication and explicit cancellation serialized with application. DFW remains the only effect/cancellation authority; this host never claims a grant was submitted.

## Receipt and trusted replay

readAcceptance(db, acceptanceId) returns only:

    { schema: 'inertia.funding-acceptance.v1', acceptanceId, command, acceptedAt }

acceptanceId is activity_log.id; command is the exact existing FundingReviewCommand. acceptedAt is activity_log.created_at, PostgreSQL transaction-start now(), NOT a commit-order timestamp. It may precede command.resolvedAt. Do not compare them to infer acceptance order.

persistActivity(tx) applies the existing redactor. Capture reads back and compares the entire details payload; any redaction/change aborts the native transaction instead of authorizing a degraded command. Activity provenance, company/issue identity, canonical command identity and a command digest are validated on replay. The digest detects corruption, not a cryptographic signature against a malicious database administrator. Plugin activity is forced to actorType=plugin by the pinned host and is rejected, even if its action/details imitate an acceptance.

Reader company scope is immutable construction-time readCompanyIds, defaulting to registered companies. Historical reads do not consult current membership, cards, document heads or mutable registrations. A separate authorized readCompanyIds scope can retain replay after registrations are retired.

listAcceptances(db, {companyId, afterId, limit}) scans only existing native activity with a maximum page size of 500. The caller must restart full sweeps after exhausting pages. Neither UUID order nor created_at is commit order: a permanent high-water cursor can miss late commits. Every discovered ID is delivered to DFW's existing idempotent audit/apply path. Live-event publication is only a hint; loss after commit does not revoke acceptance.

## Mandatory activation gates

1. Capture fails closed unless a trusted retention.assertRetentionInTransaction(tx) contract is explicitly supplied. This must establish immutable exact records and approved archival/deletion behavior. A boolean from an agent/event is never authority.
2. The supplied tests/qualification-retention.sql is TEST ONLY. It uses a user-provenance-filtered unique index and immutability guards on existing activity, with no extra tables. It intentionally blocks company deletion containing receipts. That proves the retention problem; it is not an approved production retention policy and is excluded from the host patch.
3. Existing decision_retention archives attention metadata for native subjects. It does not archive/preserve this acceptance activity payload. The pinned company deletion path deletes activity_log. A production archive/ordinary-lifecycle design remains required; no broad retention restriction is silently installed.
4. Production route composition is absent. The authenticated board verdict route must deliberately construct the service with the trusted capture implementation; plugin/request bodies must never supply hooks, bindings, permission mappings, or retention contracts.
5. Trusted binding registration and scoped reviewer-role provisioning/revocation lifecycles still require owning-service integration. Existing Paperclip roles do not automatically grant funding authority.
6. DFW integration, cancellation transport and current evidence checks must remain independently enforced. The exact target allowlist is captured without interpreting DFW discriminator strings as native/target UUIDs.

## Validation

- npm test: complete local qualification suite, 36 real PostgreSQL tests, no mocked transaction atomicity.
- Existing packaged issue-thread-interactions.test.js: 13 upstream tests via Vitest, passed.
- tests/typecheck.ts: strict declaration/host-composition typecheck, passed. Changed JS syntax checks passed.
- Five fixture-launcher/cleanup safety tests passed.
- Cold npm ci from the official registry installed 392 packages from the lock with scripts disabled; fresh official source fingerprints matched, zero-fuzz bootstrap passed, and the fresh cold installation passed all 36 native PostgreSQL cases and all 3 cross-domain scenarios. See evidence/cold-*.
- Every hardened cluster cleanup records stopped=true, removed=true after verified pidfd shutdown. The harness uses allocated loopback ports, fresh generated fixture-only SCRAM credentials, rejects inherited database routing/auth, and retains any uncertain/live workspace instead of deleting it.
- The archived strict typecheck and upstream 13-test evidence comes from the original qualified workspace; the portable npm test command reruns all 36 actual-PostgreSQL cases. The original full upstream repository build/test suite is not claimed: the installed npm package lacks its source workspace/build configuration. The actual installed service is exercised, plus its included focused regression module.

Key real-PG cases include transaction rollback, native backend termination before commit, post-commit lost response and scan discovery, eight concurrent duplicate clicks, both membership/role-revocation lock orders, wrong tenant/actor/scope, stale document expiry, changed card digest, exact-redaction rejection, no retrospective capture, immutable test receipts, and partial-card withdrawal preserving accepted items.

## Local integration fixture

From this directory:

    ./tests/with-disposable-pg.sh node tests/capture-dfw-fixture.mjs INPUT_JSON OUTPUT_JSON --mutate-after

INPUT_JSON supplies funding-only binding fields: applicantId, targetId, targetVersion, kind, reviewerRole, expectedHead, expectedWorkspaceHash, sourceScope, allowedEvidenceIds and allowedTargets. Optional verdict defaults to approve. The harness creates a fresh native company/issue/document/card/user/grant and returns the full receipt with the complete native binding in OUTPUT_JSON. --mutate-after revokes native membership and role and changes the document revision before replay, asserting the original receipt remains exact.

The fixture and caller command share one disposable cluster lifetime. For an authoritative read during that lifetime, tests/read-native-receipt.mjs accepts acceptanceId then companyId. All fixture state is synthetic and removed at verified shutdown. This is not a production service or event ingress.

## Cross-domain regression

Use the DFW project's locked Python3.14 environment, with DFW_PROJECT_ROOT pointing to its government-funding-dfw directory and NATIVE_CAPTURE_ROOT pointing to this bundle. Run that Python on cross-domain/run.py. It runs proposal apply, packet-role apply, and cancellation-first across actual native capture and actual disposable DFW SQLite domain service; DFW's separate owning-service PostgreSQL suite remains required too. Source/authority mutations after native acceptance and duplicate/offline replay are covered. The native child drops the project-location variable, but never drops inherited database-routing rejection.

No production activation is authorized by a green qualification. Scope remains exact acceptance capture and transport, not grant submission.

## Plugin-only agent tool delivery

The additive exact-hash repair in `patches/paperclip-2026.1012.0-plugin-runtime.patch`
connects authorized plugin tools to Paperclip's existing aggregate runtime MCP path.
`npm run bootstrap` and `npm run verify-and-patch` apply it after the original
capture overlay. For an existing qualified local installation, run
`npm run apply-plugin-runtime`; this edits only this bundle's installed source.
It does not start a host, change tool grants, create credentials, or call providers.

See [PLUGIN-RUNTIME-DELIVERY.md](PLUGIN-RUNTIME-DELIVERY.md) for its security
boundaries, exact-source qualification, and removal/upgrade conditions.

## Restrictive Codex command tools: source-only option

The exact adapter overlay adds `disableCommandExecution` as an optional strict
boolean. Only the qualified patched CLI adapter supports `true`. It requires
explicit `engine: "cli"` and `dangerouslyBypassApprovalsAndSandbox: false`;
`extraArgs` and legacy `args` must be absent or empty arrays, and the legacy
bypass alias cannot conflict. Invalid types or unsupported settings fail before
runtime preparation. Absent/false preserves existing behavior and defaults.

The shared fresh/resume/hello builder generates only
`features.shell_tool=false` and `features.shell_snapshot=false`. It preserves
workspace sandbox and target-network settings. The managed-connection raw
configuration/auth override guard stays byte-identical; no alternate CLI flag,
authentication home or provider route is used to evade it. This restricts command
tools, not file editing, goals, MCP or all possible tool side effects.

`npm run apply-codex-command-tools` verifies exact host build, adapter version,
all five baseline/candidate file hashes, unchanged auth-guard hash and patch
integrity before zero-fuzz application. Drift, mixed state or external symlinks
are rejected; a qualified repeat is idempotent. Bootstrap includes the same step
but never starts a service, changes agent configuration or creates a login.

Run `npm run test:codex-command-tools` with
`CODEX_COMMAND_NATIVE_ROOT` pointing to existing native node_modules.
Installer tests accept `CODEX_COMMAND_BASELINE_ROOT` for an independently retained
original adapter. To qualify actual CLI schemas, also set `CODEX_COMMAND_CLI` to
the existing Codex0.156.1 launcher. This exact test version is an evaluation
baseline, not a permanent upgrade policy. `CODEX_COMMAND_BINARY` can identify its
native executable; the receipt records launcher/binary fingerprints.

Run this qualification in a clean disposable nonroot container, network=none,
read-only root, bounded tmpfs/CPU/memory/PIDs, dropped capabilities and
no-new-privileges. It must have no personal auth, credential/home/socket mounts
or published ports. The schema fixture uses empty temporary homes, one local
unauthenticated deterministic HTTP response server and a read-only synthetic MCP
server. It exercises native deferred tool discovery; the control must advertise
command tools and both cases must load the MCP schema. It performs no model
inference. The separate native hello test uses a synthetic executable and proves
argument propagation only, not authentication. Existing plugin-runtime delivery
checks remain required.

A deployment/config change is separate: review the source, rebuild an exact clean
image, preserve the existing managed connection/state and only then configure the
approved agents with the typed setting. This source work authorizes no deployment,
personal login, sandbox change, new recipient, central tool grant or inference.

### MCP effect metadata compatibility (source qualification only)

The pinned native manifest validator, plugin registry/dispatcher and HTTP MCP projection discard effect annotations. `apply-mcp-effect-metadata` preserves only explicitly declared boolean MCP hints; missing, malformed or unknown hints remain absent and conservative. It changes no tool grant, caller binding, callback validation, approval mode or managed-auth guard. This overlay is not implicitly activated by bootstrap.

All six funding tools acquire native ownership and may update issue lifecycle, documents or domain state. They are declared `readOnlyHint=false`, `destructiveHint=true`, `openWorldHint=false`, `idempotentHint=false`. The destructive hint remains conservative even without deletion: MCP defines false as additive-only updates. Metadata correction therefore does **not** authorize headless lifecycle writes under Codex's `approval_policy=never`. No tool may be relabeled to avoid required approval.

The separately enabled owner policy is scoped CLI preapproval of the existing exact Alpha producer tools and Beta reviewer tools using native `mcp_servers.<assigned-server>.tools.<exact-name>.approval_mode="approve"`. This would remove CLI per-call prompts for those existing bounded writes while retaining fresh Paperclip grants, run/task/role checks and command-disabled sandbox. It is a separate policy change requiring scoped operator enablement; the trusted per-run builder is described below. Arbitrary managed-auth config flags remain rejected. Installation alone does not enable the default-off policy.

### Scoped native funding preapproval

Owner-approved preapproval is default-off: set `nativeFundingToolPreapproval=true` only in the existing company plugin configuration. The current `publicDrafting` configuration supplies actual producer/reviewer agent, issue, principal, project, applicant and match mappings. No agent argument or adapter config chooses the role.

After clean bootstrap, apply the metadata overlay and `npm run apply-funding-preapproval`. The latter pins the native build, four modified/added files, unchanged managed-auth guard, command-disabled adapter files and earlier runtime-delivery files. Its verifier is idempotent; use it to verify this final overlay, rather than reapplying earlier overlapping baseline patches.

The native builder intersects the fixed four producer/two reviewer names with this run's assigned tools, the live plugin dispatcher and fresh allow-only native policy decisions. Missing identity, paused/unsafe adapter, stale/finished/cross-task runs, conflicting mappings or changed configuration emit no preapproval. Existing blocked/in-review continuation rules remain tool-specific.

Only the trusted runtime envelope reaches Codex's managed `paperclip-assigned` gateway. The renderer verifies its role, exact tool names, assignment digest, same-origin gateway and full run/task identity, then emits per-tool `approval_mode="approve"`. It adds no server default. User/context gateway inputs cannot provide this envelope. Global `never`, workspace sandbox, command-tool absence and explicit bypass=false remain unchanged.

The CLI approval is a per-run snapshot. Fresh backend grant, role, run, task, source and candidate checks still govern every call; revocation prevents execution even if a prior CLI snapshot exists. No new credentials, recipients, private scope, application acceptance or external submissions are enabled.


## Restricted native Coordinator

The opt-in [native Coordinator overlay](NATIVE-COORDINATOR.md) uses the existing
Paperclip semantic tools and locked authorization paths with an exact project scope
and fixed command-disable settings. Bootstrap installs the inert restrictive code;
it does not create, configure or start an agent. `npm run test:native-coordinator`
checks the installed source. The portable disposable qualification adds synthetic
PostgreSQL checks and an unauthenticated pinned CLI feature check. Real native
autonomous continuation remains a separate acceptance gate.

### Native runner image architecture

The [runner packaging correction](NATIVE-RUNNER-PACKAGING.md) makes explicit
runner selection fail closed, rejects incompatible Linux ELF machines and adds
a read-only image preflight. Its additive Docker layer reuses only the matching
native runner from the exact official multi-architecture build; it does not
replace Codex, authentication or state. A verified source-image digest and
target-platform qualification remain required before rollout.
