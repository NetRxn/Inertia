# Inertia testing requirements and plan

Revision: INERTIA-2026-10-22-r6
Updated: 2026-10-22 (UTC)
Stage: Connected bridge and Roundtable core merged; domain integration in progress.


## Implementation evidence at r6

| Slice | State | Verified evidence | Next acceptance |
|---|---|---|---|
| Signed Buzz transport | Merged into develop | [PR 2](https://github.com/NetRxn/Inertia/pull/2), 36 tests; canonical signatures, NIP98, stable retry IDs, bounded responses and deferred Retry-After | Exercise the configured relay during live admission |
| Native authority and durable records | Merged into develop | [PR 3](https://github.com/NetRxn/Inertia/pull/3), combined 60 tests; real SDK types, PGlite SQL, atomic inbox/outbox and host query validation | Live host/relay admission and domain integration |
| Connected plugin | Merged into develop | [PR 4](https://github.com/NetRxn/Inertia/pull/4), 85 tests, typecheck/build/demo; durable retry, lookback/backfill, scoped health and addressed confirmation-card privacy | Live host/relay admission and domain integration |
| Roundtable core | Merged into develop | [PR 5](https://github.com/NetRxn/Inertia/pull/5), 23 Roundtable tests; combined repository suite 108 passing; source revisions, extractive quote grounding and deterministic materialization | Actual website publisher/readback and live source integration |
| Grant/vote, Y2 and member participation | Grant slice active; remaining adapters planned | Existing systems and public interfaces identified | Implement adapters and complete the three-outcome rehearsal |

Merged baseline: develop `1d41eeb70b02275a488a7f7583c116c8d2c77f3c`, 22 October 2026. Combined verification: 108 tests, typecheck, build and synthetic connected demo passed after PRs 4 and 5. Fixture tests use real cryptography and SQL with substituted external I/O. Live setup and rehearsal remain on the delivery path.


## Strategy and evidence

Define fixtures and expected outcomes before implementation. Reuse upstream and existing execution-integration tests; add Inertia contracts at bridge and domain boundaries. Source review identifies capabilities. Each executed test records code/configuration revisions, UTC time, fixture class, expected/actual result and receipts. The following is the required test plan.

## Connected-loop verification details

Reviewed integration commit: `ee5dcfeaeb710f5de6f8cc9eef7b15c29ad67063`. The 85-test suite adds same-thread signed receipts, restart/replay recovery, persistent retry windows, delayed-event lookback/backfill, future-event isolation, paired command guidance, addressed-card privacy and company-scoped health. `npm test -- --maxWorkers=1` avoids contention from concurrent PGlite fixture startup; this is a test-runner setting, not a runtime concurrency restriction. Typecheck, build, fixture demo and diff checks pass. The merged combined result is 108 passing tests, with typecheck, build and synthetic connected demo also passing.

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
