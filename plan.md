# Inertia connected bridge implementation plan

Revision: INERTIA-2026-10-23-r15
Updated: 2026-10-23 (UTC)
Status: DFW foundations merged; drafting/gap and Task 6 knowledge/financial contracts independently reviewed locally, awaiting publication. Core Helix partner-graph implementation is underway. October discovery draft PR42 is published; CI is running and source qualification is in review. Final scout and live integrations remain pending.

Use test-driven implementation, isolated feature branches and independent review. Inertia feature branches target develop. DFW-Gov-Fund feature branches target main; apply repository-specific merge authorization.

**Goal:** Deliver the signed Buzz ↔ native Paperclip loop with automatic meetings, grant/vote/Y2 and member contribution adapters, plus maintained partner knowledge that agents query and grow through research.

**Architecture:** A small trusted plugin connects Buzz transport to existing Paperclip tasks and decisions. Native APIs retain authority, orchestration and execution ownership. Plugin PostgreSQL stays in Paperclip’s independent native database and stores only transport bindings, inbox/outbox receipts and recovery state. Funding, meeting and admitted partner evidence use one existing DAO PostgreSQL database with isolated schemas/roles. Helix provides the core derived indexed partner graph; PG owns evidence/history and the transactional projection outbox.

**Tech Stack:** TypeScript ESM, Node 24.11+, npm lockfile, Vitest, nostr-tools, public @paperclipai/plugin-sdk matching Paperclip v2026.1012.0 / bba6a45f0d364cfd962ac59b3bdf2426a8222adb; native namespaced PostgreSQL. A PostgreSQL-compatible fixture engine may test migrations without a deployed server.

**Spec:** [spec.md](spec.md), particularly section 8. Tests and evidence: [testing.md](testing.md). Decisions: [decisions.md](decisions.md).


## Current baseline

Develop `1ac44a7a`; runtime through PR 17. See [implementation status](spec.md#implementation-status) and the exact [qualification record](testing.md#qualification-record). Live deployment and domain admission are pending.

## Global constraints

- Deliver meeting publication, grant packet vote and second-member contribution outcomes after the bridge foundation.
- Use develop as integration branch; isolated feature branches, focused commits, no force push, no main changes.
- Reuse public native SDK types and facilities. No copied private integration source, custom scheduler, task ledger, sandbox or credential store.
- No live credentials, permission changes, deployment, external messages, blockchain transactions or grant submissions in fixture builds.
- User experience: one-time pairing/configuration, automatic normal processing and recovery, meaningful concise outcomes, actionable errors without human babysitting.
- Run tests before implementation, capture failure, implement, verify, then commit. Lock dependencies and record exact source/package provenance.

## Review focus

1. A forged routing field or actor ID must not override signature-derived author or host-owned binding (tasks 1–2).
2. A native mutation may succeed while its response is lost; repeated comments must not result (tasks 3–4).
3. A dashboard decision may win between rendering and applying a Buzz reply; native outcome must remain authoritative (tasks 2 and 4).
4. Same event timestamps, empty pages and edits/deletes must not corrupt cursors or reverse prior decisions (tasks 1 and 4).
5. Restart or permanent configuration failure must not spam members or create an invisible stalled backlog (tasks 3–5).

## File map and interfaces

The foundation uses src/buzz/events.ts (including its shared event types), src/buzz/http.ts, src/bridge/types.ts, policy.ts, src/paperclip/adapter.ts and src/store/postgres.ts. The remaining file map defines the connected integration target; names may follow its reviewed exports without creating parallel models.

| Files | Responsibility |
|---|---|
| package.json, package-lock.json, tsconfig.json, vitest.config.ts | Reproducible TypeScript build and tests |
| src/buzz/events.ts, http.ts | Signed event schemas, cryptographic verification, actual /query and /events HTTP transport |
| src/bridge/types.ts, policy.ts | Trusted pairing/binding resolution, supported command parsing, card tokens, limits |
| src/paperclip/adapter.ts | Typed adapter over selected native SDK; no reimplemented host permissions |
| src/store/postgres.ts, migrations/001_bridge.sql, 003_delivery_recovery.sql | Conditional inbox/outbox writes and schema |
| src/bridge/service.ts, reconcile.ts | Verified event → native action → recoverable receipt |
| src/manifest.ts, worker.ts | Real plugin manifest, lifecycle, health, native event/job handlers |
| test/buzz.test.ts | Real signed crypto and fake-HTTP protocol tests |
| test/paperclip/adapter.test.ts, test/bridge/policy.test.ts | Native SDK call contracts and fail-closed authority |
| test/store/postgres.test.ts, test/e2e/connected-loop.test.ts | Same SQL under fixture DB, concurrency and crash tests |
| test/e2e/connected-loop.test.ts, examples/connected-demo.ts | Executable fixture demonstration and failure recovery |
| docs/bridge-state-contract.md, docs/operations.md, examples/bridge.config.json | Public version proof, minimal operator setup and secret-free configuration |

Core contracts:
- `verifyBuzzEvent(raw: unknown): VerifiedBuzzEvent` verifies canonical ID and signature before deriving author/channel/root.
- `makeBuzzHttpClient(config: BuzzClientConfig): BuzzClient` exposes `query(filters): Promise<VerifiedBuzzEvent[]>` and `publish(event): Promise<{eventId: string}>`; inject fetch and signer while retaining verification inside the client.
- `resolveCommand(event: VerifiedBuzzEvent, config: TrustedBridgeConfig): BridgeCommand | Rejection`. BridgeCommand is a discriminated comment or interactionResponse with native binding; human principal comes only from configured signed-key pairing.
- `createPaperclipAdapter(ctx: Pick<PluginContext, 'issues'>): PaperclipAdapter` exposes `comment(command)`, `listComments(binding)`, `getInteraction(binding, id)`, and `respond(command)`, using native return types where practical.
- `BridgeStore.claim(key, input): Promise<'claimed' | ExistingReceipt>` is an atomic unique insert/conditional transition; `saveOutcome`, `markUncertain`, `listRecoverable`, `putOutbox`, `markDelivered` persist transitions. No external native mutation runs inside a SQL transaction.
- `createBridge(deps): { ingest(raw: unknown): Promise<IngressOutcome>; reconcile(): Promise<HealthSummary> }`. Dependencies contain trusted config, native adapter, store, Buzz client, clock and signer. `ingest` verifies raw input internally and rejects caller flags as evidence of verification.
- `IngressOutcome` carries status applied/replayed/rejected/uncertain, source event ID, native object ID when authorized, and receipt ID. Health carries backlog count/oldest age, last success and redacted actionable error.

## Completed foundation: tasks 1–3

- Signed transport: actual Buzz filter-array `/query` and signed `/events`; canonical ID/signature checks; unambiguous channel/root tags; NIP98 binds URL, method and exact body hash. Each retry uses fresh authentication while preserving the signed outbound event.
- Bounded failure handling: redirect refusal, response/event limits, explicit permanent/configuration versus uncertain-delivery errors; server Retry-After persists when delay exceeds the short inline budget.
- Native authority: signed key resolves through trusted pairing; configured binding supplies company/issue/user IDs; host checks current membership and audience. Human comments use the native wake path once. Direct decisions support immutable plain confirmations, with native UI for target-bound or structured cases.
- Durable storage: real namespaced plugin PostgreSQL queries, atomic claims and terminal transitions; no automatic repeat of an uncertain native mutation. Fair recovery scans and keyset outbox paging prevent old uncertainty from starving new work.
- Evidence: PR 2 and PR 3 merged. The combined baseline passes 60 tests plus typecheck/build and fixture demonstration, as recorded in testing.md.

PR 4 completed the connected-plugin checks below. Domain and live acceptance continue separately.

## Completed connected loop: tasks 4–5

- Real SDK manifest/worker, declared HTTP/database/human-attributed capabilities and native recurring reconciliation job package the bridge.
- Signed human reply creates one native comment and one persisted same-thread receipt. Concurrent replay and reconstructed service reuse the accepted native result.
- Lost native response reconciles the exact correlated body and paired author. Uncertain mutation outcomes remain held until observed; native state owns dashboard-versus-Buzz decisions.
- Missing outbox records repair from saved outcomes. Lost receipt delivery retries the original signed event and persists deferred retry windows.
- Runtime checkpoints, 24-hour delayed-event lookback and resumable historical backfill survive restarts. Future-dated events cannot skip legitimate traffic. A saturated timestamp becomes an actionable blocker.
- Addressed confirmation cards preserve recipient privacy. Health and recovery scope to the company and bound conversations. Paired malformed commands receive concise guidance.
- One-command fixture demo: `npm ci && npm run demo`. Full verification: `npm test -- --maxWorkers=1 && npm run typecheck && npm run build`. The single-worker setting avoids PGlite test-startup contention.
- One-time operator setup and automatic recovery are documented in `docs/operations.md`. Live host/relay configuration is the next bridge acceptance step.
- PR 4 merged after independent review. Its 85-test suite, typecheck, build and fixture demo passed. The current combined result is recorded in the evidence table.

## Completed grant packet binding

PR 7 adds the pure grant evaluator and synthetic fixture demonstration. It reads engine-owned packet, artifact, review and current-opportunity records through an explicit trusted domain adapter. It verifies artifact bytes, freezes canonical content and review, then requires exact packet/network/proposal/action evidence from an injected verifier. Currentness and review are rechecked before evaluation; replay/conflict and invalid-calendar tests pass. The combined suite is 145 tests before the package/setup changes.

## Installable package and guided setup

The reviewed package includes compiled `dist/src/` entrypoints and SQL migrations, runs the build before packing, and qualifies a fresh production-only install with a native JSON-RPC worker handshake. A filled disabled configuration example and typed field-path validation guide the operator without exposing secret values. Use Node 24.11.0 or newer. Development test/demo commands belong in a source checkout; install the archive through Paperclip’s admitted plugin workflow for production use.

One-time setup: install the versioned archive, reference an existing signing secret, configure trusted channel/task and member mappings, validate while disabled, then enable after access checks. Routine work and transient recovery run automatically. See `docs/operations.md` for exact source-build and packaged-install steps. No live deployment is included in archive qualification.

## One-command rehearsal and cloud-first continuation

Use `npm run demo:workflow` to read the connected journey and inspect `runs/workflow-receipt.json`. Keep the receipt deterministic, linked to actual source/output/packet identifiers and explicit about synthetic I/O, fixture-seeded work and pending publication. Continue in cloud by default. Use the laptop only when a specific cloud blocker or platform check requires it; local Docker verification is reserved for a specific authorized fallback.

Replace each seam against the concrete [live handoff checklist](docs/implementation/live-handoff-checklist.md), without rebuilding the orchestration layer or requiring new routine decision ceremonies. Native work creation must preserve source-operation correlation and reconcile uncertain creates; the trusted DAO adapter owns publication idempotency/readback. Existing authority and member isolation requirements still apply.

## Repeatable latest-release maintenance

1. Run `node scripts/paperclip-upgrade.mjs` to discover the latest published host/SDK, then `node scripts/paperclip-upgrade.mjs --qualify` for isolated SDK/package checks. Follow [the upgrade recipe](docs/qualification/paperclip-upgrades.md) and record versions and integrity in the version manifest. Keep the current baseline available for reproducibility while evaluating the candidate.
2. Run compatibility, package, native-service and full-host smoke checks in a disposable environment. Exercise upgrade migrations against representative current data and compare permission/configuration changes.
3. Rehearse recovery using the previous runtime plus a verified pre-upgrade database backup. Restore the compatible database backup together with the prior runtime after schema changes.
4. Promote the qualified artifact through the deployment process and verify health/work recovery. Keep routine output concise and failures actionable. Live upgrade scheduling remains a separate operational setup task.

## Following connected product slices

Deployment ownership: Inertia engineering deploys Paperclip and connects the existing Buzz instance. Website API/schema/contracts are a separate proposal for the user’s rollout. Arrange the second participant’s repository-admin role and scoped DAO-agent enrollment independently.

These remain required product work. Build with the settled platform choices and existing native issue/artifact and bridge contracts.

1. Meetings: finish authorized Drive-ready source adaptation and single-owner native job wiring around the merged core and caller-side website publisher/readback using R-M01–04. Admit the website team’s proposed v1.1 server contract before live use. Start with supplied de-identified fixtures; real folder/publication API admission is U04–05. Test summary-only, duplicate/correction, source injection and audience before enabling routine automatic publishing. Existing Privy login only establishes authenticated-user access; propose explicit active-membership checks for the required members-only portal publication. The user owns website API/schema rollout.
2. Grants and vote: implement the [native-first grant contract](docs/development/native-grant-workflow.md). Package existing skill/CLI/MCP for native central/member agents, with scoped proposal tools and one scheduling owner. Configure real human role mappings (U13); walk one packet through native documents, human-only cards and edit → regenerate → new review before considering a custom editor. Build the trusted server decision adapter and consistent-read `ReviewedGrantSource`; test decision/version/action reconciliation, identity, stale bytes and crash/replay (T-G06–12). Current MCP acceptance/signoff is absent. Complete the Vocdoni verifier (U06) and native receipt acceptance separately, using the user’s example to establish all applicable final-action stages. Preserve exact packet/review/artifact binding and a separately authorized human submission handoff.
3. Member contribution: use existing hardened runner/provider lifecycle and native checkout, add narrow member enrollment/result boundary. Test source data limits, revoked member, stale run and hostile artifact. Do not share privileged broker credentials with members.
4. Y2: implement interest registration/update adapter against teammate API U07; deduplicate follow-ups and preserve provenance. 990 enrichment remains stretch.
5. Partner knowledge: implement the four core slices below, then connect query-first/writeback to scouting and diligence. Reuse Task 6 evidence and existing member/project identities.
6. Rehearsal: real meeting publication, current grant packet/vote, second-member contribution, shared Buzz/dashboard state and partner reuse → durable research delta → next-run retrieval. Assemble reproducible receipts and record any environment-bound work still pending.

## DAO data consolidation gate

Follow the [source-grounded storage contract](docs/development/dao-data-consolidation.md) and existing migration tools. U14 first inventories current stores read-only and verifies provider/schema/PostGIS support and backups. Assign non-overlapping Drizzle/meeting and Alembic/funding ownership, qualify role isolation and compatibility in an isolated copy, then backfill/reconcile IDs, hashes, versions and review state. An authorized cutover pauses writers, reconciles the final delta, switches scoped service bindings and checks readback. Restore-tested rollback preserves post-cutover writes and never blindly replays external effects. Keep production migration and credentials outside this design task. Planned acceptance: T-D01–06.

## Operational partner graph implementation

The maintained graph and research writeback are core work under implementation. Task 6 supplies the locally implemented evidence/SQL foundation. Helix integration is underway; projector, writeback and end-to-end qualification remain pending. Define and run failing T-K01–12 fixtures before their corresponding implementation.

1. **Align source inventory and compatibility.** Pin reviewed Task 6 and Helix SDK 3.1.0/embedded runtime 0.3.3 (U15); the first real embedded query has passed. Inventory authorized website, meeting and existing partner records with source revisions, permissions and stable member/project IDs. Seed DAO, TechFW/MADE, Moonshot, LiquidAcre and HackFW; retain unresolved identities/owners and distinguish planned from completed activity.
2. **Add typed knowledge and durable writeback.** Extend trusted admission with separately versioned entity/relationship assertions, canonical semantic conflicts and exact evidence/scope binding. Commit research deltas, existing audit history and a projection outbox in one DAO PG transaction. Backfill every inventoried partner/contact with a mapped or unresolved coverage disposition.
3. **Build indexed projection and query tools.** Implement fenced, idempotent Helix projection, active indexes and bounded partner/context/introduction queries with PG/source revalidation. Add scoped PG outage fallback. Wire scanners/diligence to query first and return answer plus useful delta, including rejected-opportunity discoveries.
4. **Qualify recovery and the demo.** Prove replay/lost response, out-of-order delivery, stale-worker fencing, tombstones, corrections/revocation, backfill overlap and generation rebuild. Qualify real PG/Helix and measure performance. Rehearse known partner reuse, newly saved knowledge and next-run retrieval before accepting the October 30 demo.

Use Paperclip's existing jobs for scheduling and real unresolved work. Projection receipts track delivery; Paperclip owns task state. Broader 990 enrichment and optional semantic/vector retrieval follow after this operational slice.

## Delivery and artifact synchronization

Proposed engineering sequence, subject to owner confirmation, with an October 29 rehearsal buffer:

Oct 22–23: connected-plugin and Roundtable core merges, then domain adapter integration. Oct 23–27: domain adapters and approved integration targets in parallel. Oct 28–29: recovery/security tests and three-outcome rehearsal (proposed October 29 buffer). Oct 30: submission deadline and owner handoff; prepare the package for the owner to submit. Update dates from actual execution evidence.

Keep spec.md, testing.md, decisions.md, plan.md and editable Inertia-Architecture.pptx at one revision before publishing the synchronized set. Original overview PDF stays byte-identical. No PDF deck export required. A code task may merge with its tests while artifact synchronization continues. Render and inspect the updated deck before delivery.

## Organizational knowledge before grant drafting

Connect authorized read access to the DAO website as part of deployment, then retrieve governance, formation and applicant evidence with citations and access labels. Retrieve the available applicant facts from that source first. Resolve only remaining gaps with the user. Keep restricted records in scoped storage and prevent publication or contributor access beyond their audience.

## Website implementation handoff

The [members-only publication and authorized knowledge proposal](docs/integrations/dao-website-member-publication-proposal.md) specifies the website-side API, schema, membership checks, publication readback and grant-evidence retrieval contracts. It is a reviewed implementation proposal; the user owns website rollout.

## Next delivery gates

1. Complete website/server, source and native job acceptance.
2. Configure the existing CEO with assigned intake, native run policy and budgets for an authorized pilot.
3. Complete grant, member and Y2 adapters and the core partner graph/query-first writeback against the contracts above.
4. Qualify each changed runtime archive through the package/native/HTTP workflow. Preserve its exact hash and receipts.
5. Publish synchronized documents and diagrams after independent review.

## Funding enhancement execution

The [detailed implementation plan](docs/development/funding-enhancement/plan.md) supplies exact files, contracts and acceptance commands. Autonomous cloud execution is authorized. Existing meeting publication, vote, member contribution and Y2 delivery continue in parallel.

| Slice | Work | Current state |
|---|---|---|
| 0 | CI and dependency baseline | Merged PR35 |
| 1 | Frozen public benchmark | Merged PR37; v3 handoff criteria in reviewed candidate; complete inventories/gold admission pending |
| 2–3 | Draft candidates and route review | Merged PR38/39; scoped public drafting/repair bridge reviewed, awaiting publication |
| 4 | Research and actionable preparation | Reviewed gap checkpoints and independent handoff review, awaiting publication |
| 5 | Canonical portable skill | Merged PR40, version 3.4.1; offline Codex install/cache verified; live runtimes pending |
| 6 | Reusable DAO knowledge and financial snapshots | Implemented and independently approved locally; unpublished/not live; real PG/importer/financial-source qualification pending |
| 6A–6D | Maintained partner graph and research writeback | Core implementation underway; typed assertions/outbox, Helix/query tools and operational acceptance pending |
| 7 | Trusted native human decisions | Planned; transactional scope/revision/authority checks required |
| 8 | General intake, funding links and DAO brief | Planned; use native work and domain records |
| 9 | Live integration rehearsal | Pending actual models, host adapters, PostgreSQL and admitted sources |

DFW main: `c615525291a656f9abd4da1262c23fa8ae97290c`. Inertia documentation source: develop `1ac44a7a5c9d8e1376e2c358ee2888b16be58905`; refresh remote base before publication. No Inertia runtime change is part of this artifact update.

Next: publish and qualify the reviewed public drafting/gap candidate, then qualify trusted independent candidate and gap-plan review in the selected host. Unfinished research remains agent-owned. Human requests carry prepared work and an exact remaining authority, access or private-record decision. Reassess the five examples against v3 preparation and handoff criteria.

Publish the reviewed Task 6 repository slices, then qualify the trusted importer, real PG concurrency/schema roles and chosen financial source. Build and qualify the core graph in slices 6A–6D. Native human-decision effects, objective intake/brief and live deployment remain explicit work.

Separately, qualify the published October discovery draft PR42 on `discovery/2026-10-23-refresh`, inspect each guarded source result, then run the authorized bounded scout and remove the temporary CI job before merge. The initial DNS-failed attempt, manual findings and replay retain distinct labels; final live results are pending. July case improvements remain a separate benchmark track. Existing meeting, vote, member and Y2 gates continue.
