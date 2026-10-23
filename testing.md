# Inertia testing requirements and plan

Revision: INERTIA-2026-10-23-r9
Updated: 2026-10-23 (UTC)
Stage: PR 17 merged into develop; exact runtime archive native-qualified. Live deployment and domain admission remain pending.


## Implementation evidence at r9

| Slice | State | Verified evidence | Next acceptance |
|---|---|---|---|
| Signed Buzz transport | Merged into develop | [PR 2](https://github.com/NetRxn/Inertia/pull/2), 36 tests; canonical signatures, NIP98, stable retry IDs, bounded responses and deferred Retry-After | Exercise the configured relay during live admission |
| Native authority and durable records | Merged into develop | [PR 3](https://github.com/NetRxn/Inertia/pull/3), combined 60 tests; real SDK types, PGlite SQL, atomic inbox/outbox and host query validation | Configured relay admission and live domain integration |
| Connected plugin | Merged into develop | [PR 4](https://github.com/NetRxn/Inertia/pull/4), 85 tests, typecheck/build/demo; durable retry, lookback/backfill, scoped health and addressed confirmation-card privacy | Configured relay admission and live domain integration |
| Roundtable core | Merged into develop | [PR 5](https://github.com/NetRxn/Inertia/pull/5), 23 Roundtable tests; 108 combined tests at PR 5; source revisions, extractive quote grounding and deterministic materialization | Website caller merged in PR 14; deployed server/source/job admission pending |
| Grant packet binding | Merged into develop | [PR 7](https://github.com/NetRxn/Inertia/pull/7), 37 grant tests; 145 combined tests at PR 7, typecheck/build and grant fixture demo pass | Production exporter, chain verifier and transactional native acceptance |
| Package and setup | Merged into develop | [PR 8](https://github.com/NetRxn/Inertia/pull/8), 149 tests, typecheck/build; clean production install and real native JSON-RPC worker handshake pass | Deploy the qualified plugin and configure authorized targets |
| Connected workflow rehearsal | Merged into develop | [PR 10](https://github.com/NetRxn/Inertia/pull/10), 152 tests and five demos pass; independently reviewed three workflow tests, typecheck/build/demo/diff | Replace explicit fixture seams with tested live adapters |
| Historical native service qualification | Passed for its recorded pre-mirror artifact | [Qualification receipt](docs/qualification/native-services.md): actual plugin loader, real PostgreSQL, four plugin migrations/eight tables, worker initialization and three registered jobs; disabled configuration validates | HTTP/API qualification also passed in the authorized isolated Docker fallback; external/live integrations remain pending |
| Latest-release qualification | Merged into develop | [PR 11](https://github.com/NetRxn/Inertia/pull/11): official registry discovery, isolated exact-lock qualification, 12 focused tests plus actual 152 runtime tests/typecheck/production package verification | Qualify each new candidate with native/HTTP checks and tested database recovery before promotion |
| Y2 and member participation | Planned required product slices | Existing systems and public interfaces identified | Implement adapters and complete the three-outcome rehearsal |

Merged baseline: develop `4841f7ade1510acf93e43ce1dbd16b91ae7bcd88`, 23 October 2026, through PR 17. PR 14 final verification passed 216 tests, typecheck and build; the original connected workflow and Roundtable demos remain explicitly synthetic. Earlier package/native/HTTP receipts qualify their recorded source baselines, not every later runtime change. No live website, cloud deployment or member integration has been admitted. PR 17 merged at 11:12:50 UTC from exact reviewed head `2a90ce24e16a72f446a7402560bd53d22f00ca38`, with 248 passing combined tests. The merge preserves its reviewed source bytes. The qualified archive/source-tree hashes below remain the evidence identity; this documentation revision does not retroactively qualify a new artifact.

## Overnight integration status

- **Website caller implemented, live publication pending.** [PR 14](https://github.com/NetRxn/Inertia/pull/14) adds exact-body operation persistence, read-before-write reconciliation, CAS corrections, full audience/content readback, bounded HTTP and actionable authentication/rate-limit outcomes. The reviewed final suite passed 216 tests. These are mocked-I/O contract checks, not deployed website acceptance. The existing demos still use `pendingDaoPublisher`.
- **Website contract remains proposed.** The [v1 proposal](docs/integrations/dao-website-member-publication-proposal.md) and [v1.1 clarification](docs/integrations/dao-website-publication-v1.1-clarifications.md) retain `roundtable-publication-v1` / `extractive-v1`. Metadata-only corrections are explicitly unsupported until a new versioned codec binds metadata. Website rollout, credentials, authorized Drive readiness and single-owner native job wiring remain admission gates.
- **Cloud setup has a concrete handoff.** [PR 13](https://github.com/NetRxn/Inertia/pull/13) specifies one authenticated private Paperclip host, durable PostgreSQL and the existing Buzz service. Owner-approved target/origin, relay thread, native company/identity pairing and signing-secret reference are still required. No deployment, credentials or live call are implied by the plan.
- **Public grant grounding is a review reference.** [PR 15](https://github.com/NetRxn/Inertia/pull/15) pins organization-published facts and provenance. It does not import applicant records or clear eligibility. Legal/tax claims need primary verification; conflicting constitutional and proposed governance rules need authenticated canonical holdings and ratification evidence.
- **Native comment mirroring is merged and tested.** [PR 17](https://github.com/NetRxn/Inertia/pull/17), head `2a90ce24e16a72f446a7402560bd53d22f00ca38`, passed 248 combined tests, typecheck/build and package verification. It merged into develop as `4841f7ade1510acf93e43ce1dbd16b91ae7bcd88`. First-publication mirroring is default-off and per-binding, with explicit `audienceAcknowledged` approval and `notBefore` history cutoff. It reuses the existing outbox/reconcile job. Delivered posts have no edit/delete propagation; suppression cannot retract uncertain prior relay acceptance. Non-expiring publication claims remain visible as `inFlightPublications`; exceptional token-matched recovery requires proving all prior workers stopped. General status mirroring remains future work.
- **The exact candidate passed native-service qualification.** [Receipt and reproduction](docs/qualification/combined-native-services/README.md) bind archive SHA-256 `19e67c88a8de52404412e49312cebfd6db42c462de3378cf3397966250add76c` to source tree `8039b3e5f54e49c302b4751445f382403381ab91`: six migrations, eight tables, three job RPCs, expected disabled health, real SQL binding and clean shutdown against unmodified Paperclip 2026.1012.0/PostgreSQL 18.1. A host array-binding regression was found and fixed before this pass. This is native-service evidence, not full HTTP/UI or live integration qualification. Earlier HTTP evidence remains historical.
- **Native CEO setup uses existing controls.** [PR 16](https://github.com/NetRxn/Inertia/pull/16) adds an operator checklist, not a bootstrap engine or live setup. Select the existing CEO by native ID and give it a bounded assigned intake issue. The shipped heartbeat does not discover arbitrary unassigned work. Use native run policy, budgets and hiring approvals; choose one native recurring mechanism rather than overlapping routine/heartbeat loops. Record the admitted run and delegated issue IDs during the authorized pilot.



## Strategy and evidence

Define fixtures and expected outcomes before implementation. Reuse upstream and existing execution-integration tests; add Inertia contracts at bridge and domain boundaries. Source review identifies capabilities. Each executed test records code/configuration revisions, UTC time, fixture class, expected/actual result and receipts. The following is the required test plan.

## Connected-loop verification details

Reviewed integration commit: `ee5dcfeaeb710f5de6f8cc9eef7b15c29ad67063`. The 85-test suite adds same-thread signed receipts, restart/replay recovery, persistent retry windows, delayed-event lookback/backfill, future-event isolation, paired command guidance, addressed-card privacy and company-scoped health. `npm test -- --maxWorkers=1` avoids contention from concurrent PGlite fixture startup; this is a test-runner setting, not a runtime concurrency restriction. Typecheck, build, fixture demo and diff checks pass. The historical combined result after PR 5 was 108 passing tests, with typecheck, build and synthetic connected demo also passing.

## Package and setup verification

Reviewed packaging commit `f68e8bb98df0bb05f9a946340d885e0bcfc6e188`: 149 of 149 tests pass, plus typecheck, build, clean package installation and a native JSON-RPC worker handshake. Archive verification checks compiled entrypoints and migrations, installs production dependencies into a fresh directory, then loads the actual worker. Configuration tests cover required nested fields, ambiguous mappings and redacted field-path errors. Node 24.11.0 or newer satisfies the selected SDK requirement. The packaged archive is an installable deliverable; deployment and live connection acceptance follow operator setup.

## Native service qualification

The pinned Paperclip plugin loader, PostgreSQL migration runner and worker services ran against a real ephemeral database. Four plugin migrations created eight tables, the worker initialized, and three jobs registered. Disabled configuration validated successfully; degraded health was expected while disabled. The full HTTP server could not start because `os.networkInterfaces` returned `ERR_SYSTEM_ERROR` / `uv_interface_addresses` under the cloud sandbox. No shim or policy bypass was used. Test processes were stopped after verification. A subsequent authorized isolated Docker fallback passed full HTTP/API qualification on the same baseline; this closes host/API qualification while the cloud restriction remains environment-specific.

## Full HTTP/API qualification

The [Docker HTTP receipt](docs/qualification/docker-http-receipt.json) identifies the source-built package by source/image/version. The delivered archive retains its separate SHA-bound package/native-service qualification. The authorized Docker fallback exercised the unmodified official Paperclip 2026.1012.0 host with Inertia source `a3e60ee5f1f9d9a295d3f744d3eca452a4ded947`: HTTP health, synthetic company creation, plugin installation, disabled configuration, actual worker validation/health, jobs and scheduled/manual disabled reconciliation passed. The database applied 304 host migrations and four plugin migrations, with eight plugin tables and three jobs. The non-root container used a read-only filesystem, no network/ports/host mounts, dropped capabilities and no-new-privileges, bounded to 2 CPU/4 GiB/256 PIDs. No OOM or source patch/shim occurred. Test containers were stopped and removed. This qualifies HTTP/API behavior with synthetic disabled configuration; browser UI and live external integrations remain separate acceptance work.

## Connected workflow rehearsal verification

Run `npm run demo:workflow` from the source checkout. Assert deterministic receipt bytes across fresh runs; meeting/work/packet provenance and hash agreement; one native mutation after bridge reconstruction and replay; fixture governance labeling; pending publication on unknown readback; and explicit pending live-adapter records. Run the transport, connected bridge, Roundtable, grant and workflow demos. The production archive remains unchanged because source-checkout demos and PGlite are excluded.

## Latest-release upgrade qualification

The implemented [upgrade workflow](docs/qualification/paperclip-upgrades.md) has 12 focused metadata/provenance/failure-path tests. Its first isolated qualification passed 152 runtime tests, typecheck and production-only package verification without changing the root lock. As checked on 23 October 2026, latest published host and SDK are both 2026.1012.0. Future candidates require their own host/migration evidence.

For each candidate host/SDK release, record exact package integrity and schema baseline; run the complete bridge/domain contracts, clean archive install, native services and HTTP/UI smoke against the candidate. Exercise migration from a representative current database, verify existing records/permissions/jobs and repeat activation without duplicate migration or work. Compare capability requirements and configuration changes. Rehearse restoring a verified pre-upgrade backup with the previous runtime, and verify restored data consistency. A successful new install alone does not qualify an upgrade or recovery path. Promote only the tested artifact; retain the result and actionable failure details.

## First build verification: B0–B5

The evidence table above records completed slices. The matrix below retains acceptance requirements for the complete connected plugin and domain adapters. Fixture end-to-end means real bridge code, signed events and real persistence queries with substituted external services; live service admission is a separate test layer.

| Suite | Precise assertions | Evidence command |
|---|---|---|
| B0 Toolchain | Exact SDK provenance, lockfile integrity; real manifest and adapter compile against public SDK | npm ci; npm run typecheck; npm run build |
| B1 Cryptography/transport | Valid signed kind9 accepted; body/id/pubkey/signature tampering and ambiguous routing rejected; NIP98 kind27235 URL/method/body hash/signature correct; redirects blocked; stable outbound event across retries | npm test -- test/buzz.test.ts |
| B2 Authority | Native IDs/actor come solely from trusted binding; unknown/revoked/agent keys cannot use human path; no extra wake for native human comment; malformed commands give guidance; host rejection preserved | npm test -- test/bridge/policy.test.ts test/paperclip/adapter.test.ts |
| B3 Persistence | Same migration and SQL execute; concurrent duplicate claim has one winner; new store instance reads prior result; invalid state transitions fail; outbox repair is unique | npm test -- test/store |
| B4 Recovery | Native commit/lost response reconciles without duplicate create; uncertainty never blind-retries; crash between outcome/outbox repairs; lost receipt retries same event; dashboard conflict returns native state; echoes do nothing | npm test -- test/e2e/connected-loop.test.ts test/e2e/connected-loop.test.ts |
| B5 Operator experience | Manifest/worker load, least declared capabilities, one-command fixture demo, concise health states and actionable redacted error, no live credentials required | npm test -- test/e2e/plugin.test.ts; npm run demo |

Transport fixtures use disposable test-only private keys generated in the test process or explicitly documented public fixture keys; never real account keys. Tests must mutate real signed bytes rather than stub verify=true. For PostgreSQL-compatible fixture engines, record engine/version and separately test native host query restrictions before live enablement. A pure in-memory JavaScript store may aid unit testing but cannot satisfy B3.

Required failure cut points: before claim, after claim before native call, native commit before response, result saved before outbox insertion, event published before receipt, and restart with unresolved applying state. Assert exact native call count and stable IDs at each point. An absent comment immediately after a timeout is not proof the request did not execute.

Interaction test fixtures include pending, already accepted, already rejected, replaced ID, same ID with changed content, member revoked after rendering and concurrent dashboard resolution. Fail closed if the pinned host cannot guarantee the required stale-content check atomically; do not claim preflight reading alone closes a race.

Demo UX acceptance: install/configuration instructions use one obvious sequence; a member never manually transfers native IDs during normal replies; successful retries are quiet; a permanent failure produces one concrete remedy and remains visible in native health. All logs exclude keys, source transcript bodies and unrelated company metadata.

## G1 compatibility qualification

Pin all integrations; compare required SDK APIs and enabled serving routes separately. Verify interactions, identity pairing, chat/provider or plugin path, native checkout/routines, runner lifecycle and connection policies. Qualify reuse permissions, packaging and admission settings. Exercise prepare, launch, submit, cancel, reconnect and cleanup against selected configuration. Select exactly one scheduling owner and explicit hiring/budget policy.

## Bridge suite

| ID | Fixture | Expected result |
|---|---|---|
| T-B01 | Paired human, paired agent, unknown key, revoked member | Authorized principal only; agent attribution never becomes human approval. |
| T-B02 | Same event concurrently and after restart | One mutation, stable native IDs and prior outcome returned. |
| T-B03 | Bridge output returns through ingress | Origin marker prevents new task or wake. |
| T-B04 | Answer v1 after interaction changes to v2 | Current state returned; obsolete decision rejected. |
| T-B05 | Conflicting simultaneous answers | One transition; second receives resolved authoritative state. |
| T-B06 | Disconnect after apply but before receipt | Cursor replay and publication reconciliation avoid duplicate action. |
| T-B07 | Buzz mention plus native routine for one task | Exactly one scheduler/checkout owner and admitted run. |
| T-B08 | Cross-company/thread request or restricted output | Denied without leaking content or metadata. |
| T-B09 | Source edit/delete within reconciliation window | Defined revision/tombstone behavior and retained audit. |
| T-B10 | Create in Buzz, resolve in dashboard, then reverse | Identical task/interaction IDs and revision. |
| T-B11 | Membership revoked after rendering | Apply-time authorization rejects answer. |
| T-B12 | Agent message carries owner attestation | Remains agent-authored, cannot satisfy human approval. |

## Grant-core verification

PR 7 adds 37 tests covering currentness, deadlines, signoffs, artifact integrity, packet/review mutation, wrong proposal/network/action, finality, conflict/replay and simulation labeling. Trusted policy snapshots precede asynchronous reads; impossible ISO dates fail without normalizing into accepted evidence. The 145-test combined suite at PR 7 and grant fixture demo passed. Live chain proofs and transactional acceptance remain integration tests.

## Domain suite

| ID | Requirements | Fixture and acceptance |
|---|---|---|
| T-M01 | R-M01 | Ready source creates one job with meeting ID, revision and hash. |
| T-M02 | R-M02 | Faithful transcript and separate notes retain uncertainty and source attribution. |
| T-M03 | R-M02 | Summary-only source produces notes plus missing-transcript exception. |
| T-M04 | R-M03–04 | Automatic upsert readback matches content, audience, URLs and version. |
| T-M05 | R-M04 | Duplicate, corrected and interrupted source updates reconcile and version once. |
| T-G01 | R-G01–02 | Current grant has cited deadline, applicant route and eligibility; expired candidate excluded. |
| T-G02 | R-G02–03 | Review/signoffs preserved; frozen packet manifest and hash reproducible. |
| T-G03 | R-G03–04 | Final valid vote matches exact packet, network and action; applied once. |
| T-G04 | R-G04 | Wrong hash/network, unfinalized/replayed vote or changed packet rejected. |
| T-Y01 | R-Y01 | Registered interest update creates/updates one linked task with provenance. |
| T-C01 | R-C01–02 | Second member acquires permitted eligible work; competing claim loses cleanly. |
| T-C02 | R-C03 | Server validates candidate artifact before trusted write; no shared credentials in member bundle. |
| T-C03 | R-C04 | Interrupted/stale run reconciles through selected lifecycle; obsolete result rejected. |
| T-C04 | R-C05 | Follow-up has parent/reason/acceptance/dedup key; repeats and limits controlled. |
| T-O01 | R-O01 | Source, issue, run, artifact, decision and receipt trace accessible in both UIs. |
| T-X01 | R-X01 | Optional 990 enrichment preserves filing provenance and reviewed relevance. |

## Security and failure suite

- T-S01: Malicious source text cannot change permissions, destinations or execution policy.
- T-S10: Repository-admin access alone grants no DAO application or control-plane authority; verify separate scoped enrollment and cross-member denial.
- T-S09: A valid Privy login without active membership cannot access material configured for members only. Verify the actual website audience and reject unauthorized narrowing claims.
- T-G05: Use the user’s Vocdoni example to determine required final-action stages. Any required but incomplete settlement remains pending; wrong chain/action/hash or missing effective authority is rejected. This is planned adapter acceptance, not an implemented FWTX verifier.
- T-S02: Foreign company/task IDs, guessed artifacts and revoked identities fail server authorization.
- T-S03: Actual selected sandbox blocks prohibited filesystem, network and process behavior; worktree isolation is tested separately.
- T-S04: Oversized, wrong-type, traversal and executable output payloads are rejected or quarantined.
- T-S05: Cancellation, timeout and lost connection follow lifecycle policy; ambiguous external writes reconcile before retry.
- T-S06: Secrets and restricted content stay out of public logs, task descriptions and Buzz channels.
- T-S07: Hiring permissions and board-approval settings apply independently of titles.
- T-S08: Native connection scopes and call-time tool policy enforce least privilege.

## Test layers and gates

1. Unit fixtures: hashes, normalization, deduplication, audience mapping, echo markers and follow-up limits.
2. Contract tests: pinned issue, interaction, runner and Buzz interfaces.
3. Integration: controlled services, real auth, injected conflicts/disconnects and authorized test targets.
4. Rehearsal: real meeting publication, current grant packet/vote and second-member contribution.

G1 establishes compatible interfaces and execution qualification. G2 reviews concrete design/configuration. G3 passes required contracts and domain acceptance. G4 reviews end-to-end evidence. Failures block their affected flow until repaired or explicitly re-scoped.

## Artifact checks

Validate common revision, requirement/test references, source pins and public-data boundary. Render and inspect every slide, re-import final PPTX, check unchanged original PDF hash and verify Git remote readback. Evidence receipts distinguish planned tests from executed results.

## Artifact coordination

The synchronized set is [spec.md](spec.md), [testing.md](testing.md), [decisions.md](decisions.md), [plan.md](plan.md), and [Inertia-Architecture.pptx](Inertia-Architecture.pptx). Update the common revision whenever new user decisions change the design. Keep stable filenames and Library identities. The original [product overview](docs/reference/Inertia-beta-product-overview.pdf) remains byte-identical historical material. Current decisions supersede its older sequencing. External configuration questions are centralized in decisions.md.

### Authorized organizational knowledge

Test authenticated retrieval of governance/formation records with citations, source version and audience labels. A publicly inaccessible document must remain an unresolved retrieval result rather than a claim that evidence is missing. Verify denied/revoked access fails closed, restricted passages do not enter public outputs or unrelated agent inputs, and only unresolved factual gaps are escalated to the user.

## Website caller qualification and admission

PR 14 final review passed 216 tests, typecheck/build and unchanged synthetic demos. Earlier 212-test documentation was an intermediate implementation receipt. Caller fixtures exercise exact persisted UTF-8 body reuse, JSONB property reordering, full immutable receipt validation, audience binding, first-write/CAS conflicts, no redirect, bounded reads, 401/403 pause, 429 timing and concurrent authorization-pause/write suppression. Metadata-only correction must fail locally with `metadata_only_correction_unsupported`.

These checks do not replace website-side real-PostgreSQL transaction/concurrency, active-membership/resource authorization, cache isolation or retention testing. Before live admission prove single-owner native persistence, durable pause/retry/withdrawal outcomes, authorized source readiness and staging canary readback. Historical host qualification must be repeated for the actual candidate package when migrations/runtime change.

## Reviewed native outbound-comment acceptance; PR 17 merged

Require default-off configuration, explicit audience approval per binding and start-time cutoff. Verify native author attribution, company/issue scoping, durable echo suppression, replay/restart, exact signed-event retry and configuration revocation without adding a scheduler or work ledger. Before first publication, re-read the native snapshot and suppress deleted/edited/ineligible comments; read failure defers rather than treating content as absent. Suppressed records must not revive through retry-blocked. Delivered posts have no edit/deletion propagation, and uncertain prior relay acceptance cannot be recalled by suppression. The combined PR 17 candidate passed 248 tests in 16 test files, plus typecheck/build and a 54-file/six-migration production package check. These results qualify the exact reviewed archive. PR 17 is now merged, but neither merge nor test success proves a live export. General status updates and CEO/work-intake flows are outside this transport slice.

## Exact combined native-service qualification

The [new receipt](docs/qualification/combined-native-services/native-services-receipt.json) records actual native installation and worker lifecycle for the exact candidate archive, six migrations/eight tables, three disabled-company job RPCs, expected disabled health, empty/single/multiple/quoted-ID SQL binding and company-isolation checks. The superseded artifact failed a real host array-binding check even though its reconcile RPC resolved; tests now assert health and actual database effects. The fixed candidate passed without modifying the official host. Retain the included lock as historical evaluation provenance, not a permanent release pin.

Native-service success does not refresh the old full-HTTP receipt. Requalify actual HTTP/auth/UI and live adapters before deployment. Interrupted publishing claims never expire or get stolen on host RPC timeout: prove all prior workers stopped, then use a token-matched administrative recovery of the same stored signed event. Normal retries and retry-blocked never recover uncertain live claims automatically.
