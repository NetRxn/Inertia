# Inertia testing requirements and plan

Revision: INERTIA-2026-10-23-r15
Updated: 2026-10-23 (UTC)
Status: DFW foundations merged; drafting/gap and Task 6 knowledge/financial contracts independently reviewed locally, awaiting publication. Core Helix partner-graph implementation is underway. October discovery draft PR42 is published; CI is running and source qualification is in review. Final scout and live integrations remain pending.


## Qualification record

| Evidence | Identity and scope |
|---|---|
| Reviewed runtime | PR 17 head `2a90ce24e16a72f446a7402560bd53d22f00ca38`, merged 2026-10-23 11:12:50 UTC at `4841f7ade1510acf93e43ce1dbd16b91ae7bcd88`; reviewed source bytes preserved |
| Test/build/package | 248 tests in 16 files; typecheck and build; 54-file production package with six migrations |
| Exact native-qualified archive SHA-256 | `19e67c88a8de52404412e49312cebfd6db42c462de3378cf3397966250add76c` |
| Archive source tree | `8039b3e5f54e49c302b4751445f382403381ab91` |
| Native host | Unmodified Paperclip 2026.1012.0 and PostgreSQL 18.1; six migrations, eight tables, three disabled job RPCs, expected disabled health, SQL binding/company isolation and clean lifecycle |
| HTTP/API | Historical pre-mirror source `a3e60ee5f1f9d9a295d3f744d3eca452a4ded947`; candidate HTTP/auth/UI acceptance pending |
| External services | Synthetic demo I/O; live website, Drive, grant/vote, member and Y2 acceptance pending |

[Native receipt and reproduction](docs/qualification/combined-native-services/README.md). Qualification applies to the exact archive above. Documentation baseline: develop `1ac44a7a`.

### Historical slice evidence

| Slice | State | Verified evidence | Next acceptance |
|---|---|---|---|
| Signed Buzz transport | Merged into develop | [PR 2](https://github.com/NetRxn/Inertia/pull/2), 36 tests; canonical signatures, NIP98, stable retry IDs, bounded responses and deferred Retry-After | Exercise the configured relay during live admission |
| Native authority and durable records | Merged into develop | [PR 3](https://github.com/NetRxn/Inertia/pull/3), combined 60 tests; real SDK types, PGlite SQL, atomic inbox/outbox and host query validation | Configured relay admission and live domain integration |
| Connected plugin | Merged into develop | [PR 4](https://github.com/NetRxn/Inertia/pull/4), 85 tests, typecheck/build/demo; durable retry, lookback/backfill, scoped health and addressed confirmation-card privacy | Configured relay admission and live domain integration |
| Roundtable core | Merged into develop | [PR 5](https://github.com/NetRxn/Inertia/pull/5), 23 Roundtable tests; 108 combined tests at PR 5; source revisions, extractive quote grounding and deterministic materialization | Website caller merged in PR 14; deployed server/source/job admission pending |
| Grant packet binding | Merged into develop | [PR 7](https://github.com/NetRxn/Inertia/pull/7), 37 grant tests; 145 combined tests at PR 7, typecheck/build and grant fixture demo pass | Trusted domain/human-decision adapter, chain verifier and native receipt acceptance |
| Package and setup | Merged into develop | [PR 8](https://github.com/NetRxn/Inertia/pull/8), 149 tests, typecheck/build; clean production install and real native JSON-RPC worker handshake pass | Deploy the qualified plugin and configure authorized targets |
| Connected workflow rehearsal | Merged into develop | [PR 10](https://github.com/NetRxn/Inertia/pull/10), 152 tests and five demos pass; independently reviewed three workflow tests, typecheck/build/demo/diff | Replace explicit fixture seams with tested live adapters |
| Historical native service qualification | Passed for its recorded pre-mirror artifact | [Qualification receipt](docs/qualification/native-services.md): actual plugin loader, real PostgreSQL, four plugin migrations/eight tables, worker initialization and three registered jobs; disabled configuration validates | HTTP/API qualification also passed in the authorized isolated Docker fallback; external/live integrations remain pending |
| Latest-release qualification | Merged into develop | [PR 11](https://github.com/NetRxn/Inertia/pull/11): official registry discovery, isolated exact-lock qualification, 12 focused tests plus actual 152 runtime tests/typecheck/production package verification | Qualify each new candidate with native/HTTP checks and tested database recovery before promotion |
| Y2 and member participation | Planned required product slices | Existing systems and public interfaces identified | Implement adapters and complete the three-outcome rehearsal |

## Strategy and evidence

Define fixtures and expected outcomes before implementation. Reuse upstream and existing execution-integration tests; add Inertia contracts at bridge and domain boundaries. Source review identifies capabilities. Each executed test records code/configuration revisions, UTC time, fixture class, expected/actual result and receipts. The following is the required test plan.

## Shared DAO storage acceptance (planned)

Design acceptance only; none of these checks has run against deployed DAO storage. Source evidence and migration sequence: [data consolidation contract](docs/development/dao-data-consolidation.md).

| ID | Check | Required result |
|---|---|---|
| T-D01 | Provider/schema compatibility and migration dry run | Actual version, schema/role support, PostGIS and backup restore verified; funding PostgreSQL types/constraints and schema-qualified SQL pass; SQLite success alone is insufficient. |
| T-D02 | Migration ownership/collisions | Drizzle touches only website/meeting-owned objects; Alembic only funding-owned objects/history. Existing table/ID names, indexes and foreign keys cannot collide or be silently dropped. |
| T-D03 | Cross-schema and row/audience isolation | Meeting role cannot read/write funding tables; funding role cannot read membership or unrestricted meeting data. Test direct SQL, unsafe search paths, new-table default grants, revoked roles, cross-applicant/company and expired membership. Narrow authorized API/view access works without widening grants. |
| T-D04 | Backfill and consistent-read reconciliation | Counts, stable IDs/FKs, JSON/time values, hashes, immutable versions, reviews and publication readbacks match; concurrent edits cannot produce a mixed-version packet or duplicate decision. |
| T-D05 | Cutover/rollback rehearsal | Pause/delta/switch/readback sequence and restore pass in isolation; reconcile post-cutover writes and external effects before resuming. No dual authoritative writers, lost reviews or duplicate publication/submission. |
| T-D06 | Core Helix projection safety | Evidence/history/outbox commit atomically in DAO PostgreSQL; projection replay/rebuild converges by canonical ID/revision. Read-time source/access checks deny stale/revoked records immediately, including during projector failure. Bounded indexed PostgreSQL fallback preserves useful reads; authoritative-state failure withholds affected results. Detailed pre-implementation gates: T-K01–12. |

## Operational partner graph acceptance (planned)

Define each fixture before its corresponding implementation. Task 6's evidence/SQL tests pass locally; Helix and end-to-end writeback acceptance remain planned. The graph is core release work; vector retrieval and broader 990 enrichment are later extensions. Official Helix SDK 3.1.0/embedded runtime 0.3.3 are installed and a real embedded query passed; the full graph acceptance matrix remains pending.

| ID | Requirement | Fixture and required result |
|---|---|---|
| T-K01 | R-K01–02 | Seed DAO, MADE → TechFW, disambiguated Moonshot and LiquidAcre, plus HackFW. Preserve accepted collaborator evidence separately from candidate name aliases; unrelated same-name organizations/people stay separate. Audited merge/split preserves history and reprojects. |
| T-K02 | R-K01 | Every inventoried partner, relevant contact/role, project/event, contribution and relationship owner has a stable ID or explicit unresolved disposition tied to its processed source revision. Re-run creates no duplicates; private member fields outside scope are absent. |
| T-K03 | R-K02 | Prospects, public employees, coattendees and evidenced collaborators yield distinct results. Planned/started/completed activity requires its own evidence; October 30 passing cannot complete a host role. Unknown relationship owners stay unassigned. |
| T-K04 | R-K02,06 | Cross-tenant/audience/project/opportunity attempts fail at lookup, each path hop and contact/quote hydration. Source revision, role end-date and access revocation invalidate retrieval immediately with the projector stalled. Unavailable authoritative checks fail closed. |
| T-K05 | R-K03,08 | Instrument a scan to prove saved evidence is queried before external discovery. Reuse current evidence, research only gaps, commit useful findings from an accepted and a rejected opportunity, then retrieve both on the next run. An explained zero delta completes without a graph write; a silently lost useful delta fails. |
| T-K06 | R-K04 | Crash before/after PG commit; concurrent identical delta keys; same key with changed payload; corroborating source and semantic conflict. One atomic evidence/history/outbox commit, replayed receipt, payload conflict and separate scoped source bindings result. |
| T-K07 | R-K04–05 | Helix outage, lost write response, duplicate/out-of-order delivery, lease loss/restart and old-worker resume after a newer deletion converge. Target-side fence/revision guards reject the old write; no durable delta is lost and no tombstone resurrects. |
| T-K08 | R-K01,05 | Backfill overlaps incremental ingestion, interrupted keyset pages resume and an uncommitted lower sequence arrives late. Coverage has no gaps. Rebuild a new generation from PG plus a gap-safe high-water mark; reconcile canonical IDs/revision counts/hashes before switching. |
| T-K09 | R-K02,04 | Same quote with altered triple/resolved identity cannot reuse admission. Differently worded equivalent typed values corroborate; overlapping single-valued contradictions dispute; multiple capabilities/affiliations coexist without scope widening. Legacy dao-knowledge-v1 comparison behavior is preserved. |
| T-K10 | R-K06–07 | Bounded capability, partner context and ≤3-hop introduction queries return cited evidence and gaps. A coattendee is not a promised introduction. Helix outage/lag uses indexed PG fallback with explicit degraded coverage; filtering cannot turn partial coverage into “no partner exists.” |
| T-K11 | R-K08 | On the documented initial target fixture of 10,000 entities/100,000 assertions, verify active indexes and indexed query starts. Measure top-20 queries including PG revalidation p95 <1 second and update visibility p95 <60 seconds; record actual version/hardware/results rather than asserting these targets already passed. |
| T-K12 | R-K01–08 | Real disposable PostgreSQL concurrent admission/source changes and schema/role denials, plus pinned actual Helix API transactions/fencing/indexes/deletion, pass before the October 30 end-to-end rehearsal is accepted. IRS EIN/status evidence, uncollected determination letter and distinct service geography remain correctly labeled. |

## Connected-loop verification details

Reviewed integration commit: `ee5dcfeaeb710f5de6f8cc9eef7b15c29ad67063`. The 85-test suite adds same-thread signed receipts, restart/replay recovery, persistent retry windows, delayed-event lookback/backfill, future-event isolation, paired command guidance, addressed-card privacy and company-scoped health. `npm test -- --maxWorkers=1` limits concurrent PGlite fixture startup. Runtime concurrency is qualified separately. Typecheck, build, fixture demo and diff checks pass. The historical combined result after PR 5 was 108 passing tests, with typecheck, build and synthetic connected demo also passing.

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

For each candidate host/SDK release, record exact package integrity and schema baseline; run the complete bridge/domain contracts, clean archive install, native services and HTTP/UI smoke against the candidate. Exercise migration from a representative current database, verify existing records/permissions/jobs and repeat activation without duplicate migration or work. Compare capability requirements and configuration changes. Rehearse restoring a verified pre-upgrade backup with the previous runtime, and verify restored data consistency. Qualify upgrade and recovery paths separately from a clean installation. Promote only the tested artifact; retain the result and actionable failure details.

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

Transport fixtures use disposable test-only private keys generated in the test process or explicitly documented public fixture keys; never real account keys. Tests must mutate real signed bytes and exercise verification. For PostgreSQL-compatible fixture engines, record engine/version and separately test native host query restrictions before live enablement. A pure in-memory JavaScript store may aid unit testing but cannot satisfy B3.

Required failure cut points: before claim, after claim before native call, native commit before response, result saved before outbox insertion, event published before receipt, and restart with unresolved applying state. Assert exact native call count and stable IDs at each point. After a timeout, keep the mutation outcome uncertain until authoritative reconciliation establishes whether it executed.

Interaction test fixtures include pending, already accepted, already rejected, replaced ID, same ID with changed content, member revoked after rendering and concurrent dashboard resolution. Require an atomic stale-content check from the pinned host; fail closed when unavailable.

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

## Native grant review acceptance (planned)

Implementation and execution of these adapter tests remain pending. Qualify against the [pinned release and funding source](docs/reference/native-grant-workflow.md).

| ID | Fixture | Required result |
|---|---|---|
| T-G06 | Agent resolver, wrong addressed human, wrong role or forged actor/decision ID | Explicit human-only policy plus authenticated native readback and configured role mapping deny application. |
| T-G07 | Changed document revision, workspace hash, packet version, review or artifact bytes | Old decision cannot advance the packet; correction generates a new proposal/review; changed frozen content needs a new vote. |
| T-G08 | Duplicate/multi-item/partially resolved card; crash before/after write or receipt | Item decision identity = interaction ID + item ID. Reconcile with proposal/packet ID + version + action; distinct items do not collide. Apply once using each item’s actor/verdict; hold unknown outcomes. |
| T-G09 | Proposal/role reject, defer, or partner N/A action | Proposal reject → rejected; role reject → changes_requested. Defer has no write; none advances review. Only an explicit partner action can record not_applicable, never inferred from reject/defer. |
| T-G10 | Cross-company/applicant read; member requests privileged tools or credentials | Deny access; member receives only authorized evidence and proposal tools, no database/admin keys or portal credentials. |
| T-G11 | Native approval, packet readiness, passed vote or submission-record request | No portal submission side effect. Manual-submission receipt requires the domain-approved state and separately authorized human action. |
| T-G12 | Real packet with one correction; central and member draft paths | Native task/doc/cards remain one workflow; edit → regenerate → new review works without a custom panel or duplicate scheduler. |

Also prove each route’s required roles: direct application has five; partner contribution four; next-cycle readiness program/fiscal; monitor-only none. Native document freshness never substitutes for exact external artifact-byte verification.

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
- T-G05: Use the user’s Vocdoni example to determine required final-action stages. Any required but incomplete settlement remains pending; wrong chain/action/hash or missing effective authority is rejected. FWTX verifier implementation and adapter acceptance remain pending.
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
4. Rehearsal: real meeting publication, current grant packet/vote, second-member contribution and operational partner query → research → durable delta → next-run reuse.

G1 establishes compatible interfaces and execution qualification. G2 reviews concrete design/configuration. G3 passes required contracts and domain acceptance. G4 reviews end-to-end evidence. Failures block their affected flow until repaired or explicitly re-scoped.

## Artifact checks

Validate common revision, requirement/test references, source pins and public-data boundary. Render and inspect every slide, re-import final PPTX, check unchanged original PDF hash and verify Git remote readback. Evidence receipts distinguish planned tests from executed results.

## Related artifacts

[Specification](spec.md) · [Tests](testing.md) · [Decisions](decisions.md) · [Plan](plan.md) · [Editable architecture](Inertia-Architecture.pptx). Original [product overview](docs/reference/Inertia-beta-product-overview.pdf) retained unchanged.

## Authorized organizational knowledge

Test authenticated retrieval with citations, source version and audience labels. Treat inaccessible records as retrieval pending. Denied or revoked access fails closed; restricted passages stay out of public outputs and unrelated agent inputs. Escalate factual gaps only after an authorized search establishes them.

## Website caller qualification and admission

PR 14 final review passed 216 tests, typecheck/build and unchanged synthetic demos. Earlier 212-test documentation was an intermediate implementation receipt. Caller fixtures exercise exact persisted UTF-8 body reuse, JSONB property reordering, full immutable receipt validation, audience binding, first-write/CAS conflicts, no redirect, bounded reads, 401/403 pause, 429 timing and concurrent authorization-pause/write suppression. Metadata-only correction must fail locally with `metadata_only_correction_unsupported`.

Website-side real-PostgreSQL transaction/concurrency, active-membership/resource authorization, cache isolation and retention tests remain separate acceptance gates. Before live admission prove single-owner native persistence, durable pause/retry/withdrawal outcomes, authorized source readiness and staging canary readback. Historical host qualification must be repeated for the actual candidate package when migrations/runtime change.

## Reviewed native outbound-comment acceptance; PR 17 merged

Require default-off configuration, explicit audience approval per binding and start-time cutoff. Verify native author attribution, company/issue scoping, durable echo suppression, replay/restart, exact signed-event retry and configuration revocation without adding a scheduler or work ledger. Before first publication, re-read the native snapshot and suppress deleted/edited/ineligible comments; read failure defers publication until the native snapshot can be retrieved. Suppressed records must not revive through retry-blocked. Delivered posts have no edit/deletion propagation, and uncertain prior relay acceptance cannot be recalled by suppression. The combined PR 17 candidate passed 248 tests in 16 test files, plus typecheck/build and a 54-file/six-migration production package check. These results qualify the exact reviewed archive. PR 17 is now merged, but neither merge nor test success proves a live export. General status updates and CEO/work-intake flows are outside this transport slice.

## Exact combined native-service qualification

The [new receipt](docs/qualification/combined-native-services/native-services-receipt.json) records actual native installation and worker lifecycle for the exact candidate archive, six migrations/eight tables, three disabled-company job RPCs, expected disabled health, empty/single/multiple/quoted-ID SQL binding and company-isolation checks. The superseded artifact failed a real host array-binding check even though its reconcile RPC resolved; tests now assert health and actual database effects. The fixed candidate passed without modifying the official host. Retain the included lock as historical evaluation provenance and qualify newer releases separately.

The full-HTTP receipt remains historical; requalify HTTP/auth/UI against the current artifact. Requalify actual HTTP/auth/UI and live adapters before deployment. Interrupted publishing claims never expire or get stolen on host RPC timeout: prove all prior workers stopped, then use a token-matched administrative recovery of the same stored signed event. Normal retries and retry-blocked never recover uncertain live claims automatically.

## Funding enhancement qualification

Detailed [acceptance requirements](docs/development/funding-enhancement/testing.md) cover R-F01–08 and R-I01–04. DFW PR35, PR37, PR38, PR39 and PR40 are merged. Portable skills 3.4.1 main is `c615525291a656f9abd4da1262c23fa8ae97290c`; [exact-head CI 39999694731](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/39999694731) passed all steps. Codex offline installation and cache refresh are verified. Next, qualify live model/tool execution.

Public drafting and actionable-gap continuation are independently reviewed local work, awaiting publication. The combined candidate passed 451 tests with one manifest failure caused by the snapshot's missing pre-existing PPTX; the manifest entry is preserved. Independent focused review passed 125 tests. Ruff, mypy (100 source files), compileall and build passed. Complete-tree remote CI remains a publication gate.

- Benchmark v3 requires source-bound preparation, a precise remaining decision and independent agreement that no useful agent work remains. The earlier v2 result of 5/5 useful fields and 14 genuine requests is historical only and requires reassessment. Five partial cases cover eight captured requirements; full sponsor inventories and independent gold admission remain incomplete.
- Verify actual scoped MCP persistence, restart/replay, checkpoint conflicts, wrong-plan rejection, source/contact provenance and preparation retained in Markdown/DOCX. A missing reviewer capability must keep the task agent-owned.
- Qualify actual Codex, Claude, a named local runtime and configured Paperclip adapters on the same frozen evidence. Evaluate live semantic quality with the selected models in addition to controlled reviewer fixtures.
- Keep current public enrichment, synthetic contracts and exact July replay separate. Qualify PostgreSQL concurrency, knowledge/financial scope, native authorization/revocation, ordered intake and live deployment independently.

Task 6 (`dao-knowledge-v1`) is locally implemented and independently approved, unpublished and not live. DFW: 55 knowledge and 118 financial tests; full suite 624 passed with the same missing-baseline-PPTX manifest failure, Ruff, strict mypy (102 files), compileall, build, locked audit and SQLite 0014 up/down/up passed. Inertia: 50 new knowledge tests, 298/298 total, typecheck/build, clean production package and module smoke passed. Independent review ran 254 DFW focused/integration tests and the Inertia checks. Real PostgreSQL concurrency/schema roles, trusted importer and actual financial-source compatibility remain unexecuted.

October discovery is a separate branch and evidence track. The reviewed repair suite recorded 558 passed, one private-snapshot skip and the missing-PPTX manifest failure; private page replay/receipt checks passed 8. The first actual scout failed public DNS before acquisition and yielded zero candidates. Manual research (33 findings), dated parser replay and live acquisition have separate evidence records. Draft PR42 is published; CI is running and source qualification is in review. Final source review/scout and complete-tree CI remain pending. Keep fresh October leads and results separate from July improvement scores.

Exact implementation references and remaining gates: [source map](docs/development/funding-enhancement/source-map.md).
