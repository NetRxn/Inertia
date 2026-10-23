# Inertia connected bridge implementation plan

Revision: INERTIA-2026-10-23-r8
Updated: 2026-10-23 (UTC)

> Agentic workers: use test-driven implementation in isolated feature branches, followed by focused independent review. The user has authorized autonomous engineering decisions and feature merges into develop while offline.

**Goal:** Deliver a working signed Buzz ↔ native Paperclip interaction loop, then attach automatic meetings, grant/vote/Y2 and member contribution adapters.

**Architecture:** A small trusted plugin connects Buzz transport to existing Paperclip tasks and decisions. Native APIs retain authority, orchestration and execution ownership. Plugin PostgreSQL stores only transport bindings, inbox/outbox receipts and recovery state.

**Tech Stack:** TypeScript ESM, Node 24.11+, npm lockfile, Vitest, nostr-tools, public @paperclipai/plugin-sdk matching Paperclip v2026.1012.0 / bba6a45f0d364cfd962ac59b3bdf2426a8222adb; native namespaced PostgreSQL. A PostgreSQL-compatible fixture engine may test migrations without a deployed server.

**Spec:** [spec.md](spec.md), particularly section 8. Tests and evidence: [testing.md](testing.md). Decisions: [decisions.md](decisions.md).


## Implementation evidence at r8

| Slice | State | Verified evidence | Next acceptance |
|---|---|---|---|
| Signed Buzz transport | Merged into develop | [PR 2](https://github.com/NetRxn/Inertia/pull/2), 36 tests; canonical signatures, NIP98, stable retry IDs, bounded responses and deferred Retry-After | Exercise the configured relay during live admission |
| Native authority and durable records | Merged into develop | [PR 3](https://github.com/NetRxn/Inertia/pull/3), combined 60 tests; real SDK types, PGlite SQL, atomic inbox/outbox and host query validation | Configured relay admission and live domain integration |
| Connected plugin | Merged into develop | [PR 4](https://github.com/NetRxn/Inertia/pull/4), 85 tests, typecheck/build/demo; durable retry, lookback/backfill, scoped health and addressed confirmation-card privacy | Configured relay admission and live domain integration |
| Roundtable core | Merged into develop | [PR 5](https://github.com/NetRxn/Inertia/pull/5), 23 Roundtable tests; 108 combined tests at PR 5; source revisions, extractive quote grounding and deterministic materialization | Actual website publisher/readback and live source integration |
| Grant packet binding | Merged into develop | [PR 7](https://github.com/NetRxn/Inertia/pull/7), 37 grant tests; 145 combined tests at PR 7, typecheck/build and grant fixture demo pass | Production exporter, chain verifier and transactional native acceptance |
| Package and setup | Merged into develop | [PR 8](https://github.com/NetRxn/Inertia/pull/8), 149 tests, typecheck/build; clean production install and real native JSON-RPC worker handshake pass | Deploy the qualified plugin and configure authorized targets |
| Connected workflow rehearsal | Merged into develop | [PR 10](https://github.com/NetRxn/Inertia/pull/10), 152 tests and five demos pass; independently reviewed three workflow tests, typecheck/build/demo/diff | Replace explicit fixture seams with tested live adapters |
| Native service qualification | Passed against pinned Paperclip services | [Qualification receipt](docs/qualification/native-services.md): actual plugin loader, real PostgreSQL, four plugin migrations/eight tables, worker initialization and three registered jobs; disabled configuration validates | HTTP/API qualification also passed in the authorized isolated Docker fallback; external/live integrations remain pending |
| Latest-release qualification | Merged into develop | [PR 11](https://github.com/NetRxn/Inertia/pull/11): official registry discovery, isolated exact-lock qualification, 12 focused tests plus actual 152 runtime tests/typecheck/production package verification | Qualify each new candidate with native/HTTP checks and tested database recovery before promotion |
| Y2 and member participation | Planned required product slices | Existing systems and public interfaces identified | Implement adapters and complete the three-outcome rehearsal |

Merged baseline: develop `ec26c1b850e7937a9d5b1561c1a27b43d06394de`, 23 October 2026. Combined verification after PR 10: 152 tests, typecheck, build and five demos passed. Package/install qualification from PR 8 remains unchanged; the workflow demo is source-checkout-only. Fixture tests use real cryptography and SQL with substituted external I/O. Live setup and rehearsal remain on the delivery path.


## Global constraints

- Preserve required meeting publication, grant packet vote and second-member contribution outcomes; the bridge is the first build slice, not the whole demo.
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
- `makeBuzzHttpClient(config: BuzzClientConfig): BuzzClient` exposes `query(filters): Promise<VerifiedBuzzEvent[]>` and `publish(event): Promise<{eventId: string}>`; fetch and signer are injected, not verification.
- `resolveCommand(event: VerifiedBuzzEvent, config: TrustedBridgeConfig): BridgeCommand | Rejection`. BridgeCommand is a discriminated comment or interactionResponse with native binding; human principal comes only from configured signed-key pairing.
- `createPaperclipAdapter(ctx: Pick<PluginContext, 'issues'>): PaperclipAdapter` exposes `comment(command)`, `listComments(binding)`, `getInteraction(binding, id)`, and `respond(command)`, using native return types where practical.
- `BridgeStore.claim(key, input): Promise<'claimed' | ExistingReceipt>` is an atomic unique insert/conditional transition; `saveOutcome`, `markUncertain`, `listRecoverable`, `putOutbox`, `markDelivered` persist transitions. No external native mutation runs inside a SQL transaction.
- `createBridge(deps): { ingest(raw: unknown): Promise<IngressOutcome>; reconcile(): Promise<HealthSummary> }`. Dependencies contain trusted config, native adapter, store, Buzz client, clock and signer. `ingest` verifies internally, not a caller-supplied Verified flag.
- `IngressOutcome` carries status applied/replayed/rejected/uncertain, source event ID, native object ID when authorized, and receipt ID. Health carries backlog count/oldest age, last success and redacted actionable error.

## Completed foundation: tasks 1–3

- Signed transport: actual Buzz filter-array `/query` and signed `/events`; canonical ID/signature checks; unambiguous channel/root tags; NIP98 binds URL, method and exact body hash. Each retry uses fresh authentication while preserving the signed outbound event.
- Bounded failure handling: redirect refusal, response/event limits, explicit permanent/configuration versus uncertain-delivery errors; server Retry-After persists when delay exceeds the short inline budget.
- Native authority: signed key resolves through trusted pairing; configured binding supplies company/issue/user IDs; host checks current membership and audience. Human comments use the native wake path once. Direct decisions support immutable plain confirmations, with native UI for target-bound or structured cases.
- Durable storage: real namespaced plugin PostgreSQL queries, atomic claims and terminal transitions; no automatic repeat of an uncertain native mutation. Fair recovery scans and keyset outbox paging prevent old uncertainty from starving new work.
- Evidence: PR 2 and PR 3 merged. The combined baseline passes 60 tests plus typecheck/build and fixture demonstration, as recorded in testing.md.

The checklist below describes the remaining connected-plugin acceptance work. The connected implementation has merged in PR 4. Its reviewed checks are recorded below; domain and live integration acceptance continue separately.

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

PR 7 adds the pure grant evaluator and synthetic fixture demonstration. It composes an explicit trusted export port over engine-owned packet, artifact, review and current-opportunity records. It verifies artifact bytes, freezes canonical content and review, then requires exact packet/network/proposal/action evidence from an injected verifier. Currentness and review are rechecked before evaluation; replay/conflict and invalid-calendar tests pass. The combined suite is 145 tests before the package/setup changes.

## Installable package and guided setup

The reviewed package includes compiled `dist/src/` entrypoints and SQL migrations, runs the build before packing, and qualifies a fresh production-only install with a native JSON-RPC worker handshake. A filled disabled configuration example and typed field-path validation guide the operator without exposing secret values. Use Node 24.11.0 or newer. Development test/demo commands belong in a source checkout; install the archive through Paperclip’s admitted plugin workflow for production use.

One-time setup: install the versioned archive, reference an existing signing secret, configure trusted channel/task and member mappings, validate while disabled, then enable after access checks. Routine work and transient recovery run automatically. See `docs/operations.md` for exact source-build and packaged-install steps. No live deployment is included in archive qualification.

## One-command rehearsal and cloud-first continuation

Use `npm run demo:workflow` to read the connected journey and inspect `runs/workflow-receipt.json`. Keep the receipt deterministic, linked to actual source/output/packet identifiers and explicit about synthetic I/O, fixture-seeded work and pending publication. Continue in cloud by default. Use the laptop only when a specific cloud blocker or platform check requires it; local Docker verification is reserved for a specific authorized fallback.

Replace each seam against the concrete [live handoff checklist](docs/implementation/live-handoff-checklist.md), without rebuilding the orchestration layer or requiring new routine decision ceremonies. Native work creation must preserve source-operation correlation and reconcile uncertain creates; the trusted DAO adapter owns publication idempotency/readback. Existing authority and member isolation requirements still apply.

## Repeatable latest-release maintenance

1. Run `node scripts/paperclip-upgrade.mjs` to discover the latest published host/SDK, then `node scripts/paperclip-upgrade.mjs --qualify` for isolated SDK/package checks. Follow [the upgrade recipe](docs/qualification/paperclip-upgrades.md) and record versions and integrity in the version manifest. Keep the current baseline available for reproducibility while evaluating the candidate.
2. Run compatibility, package, native-service and full-host smoke checks in a disposable environment. Exercise upgrade migrations against representative current data and compare permission/configuration changes.
3. Rehearse recovery using the previous runtime plus a verified pre-upgrade database backup. Do not rely on binary downgrade after schema changes.
4. Promote the qualified artifact through the deployment process and verify health/work recovery. Keep routine output concise and failures actionable. A live upgrade schedule is a separate operational setup, not enabled by this planning change.

## Following connected product slices

Deployment ownership: Inertia engineering deploys Paperclip and connects the existing Buzz instance. Website API/schema/contracts are a separate proposal for the user’s rollout. Arrange the second participant’s repository-admin role and scoped DAO-agent enrollment independently.

These remain required product work. Build with the same native issue/artifact and bridge contracts; do not re-open settled platform choices.

1. Meetings: implement Drive-ready source adapter, faithful transcript/notes transformer and website publisher/readback using R-M01–04. Start with supplied de-identified fixtures; real folder/publication API admission is U04–05. Test summary-only, duplicate/correction, source injection and audience before enabling routine automatic publishing. Existing Privy login only establishes authenticated-user access; propose explicit active-membership checks for the required members-only portal publication. The user owns website API/schema rollout.
2. Grants and vote: complete a consistent-read production exporter from the scanner engine, a Vocdoni governance verifier (U06) for effective final authority under the user’s actual setup, and transactional acceptance on the native work item. Use the user-provided example to confirm network, completed proposal evidence and any applicable Aragon/final-action stage; require all stages that actually authorize the action. The merged pure evaluator already covers canonical packet/review binding and negative fixtures. Revalidate source revision at the eventual manual engine handoff; preserve engine signoffs and authorized-representative submission.
3. Member contribution: use existing hardened runner/provider lifecycle and native checkout, add narrow member enrollment/result boundary. Test source data limits, revoked member, stale run and hostile artifact. Do not share privileged broker credentials with members.
4. Y2: implement interest registration/update adapter against teammate API U07; deduplicate follow-ups and preserve provenance. 990 enrichment remains stretch.
5. Rehearsal: real meeting publication, current grant packet/vote, second-member contribution and shared Buzz/dashboard state. Assemble reproducible receipts and record any environment-bound work still pending.

## Delivery and artifact synchronization

Proposed engineering sequence, with the October 29 rehearsal as a buffer rather than an owner commitment:

Oct 22–23: connected-plugin and Roundtable core merges, then domain adapter integration. Oct 23–27: domain adapters and approved integration targets in parallel. Oct 28–29: recovery/security tests and three-outcome rehearsal (proposed October 29 buffer). Oct 30: submission deadline and owner handoff; prepare the package for the owner to submit. Update exact dates with actual execution evidence, not assumed progress.

Keep spec.md, testing.md, decisions.md, plan.md and editable Inertia-Architecture.pptx at one revision before publishing the synchronized set. Original overview PDF stays byte-identical. No PDF deck export required. A code task may merge independently with its tests while the artifact sync catches up, but do not claim the deck has been updated until rendered and checked.

## Planner self-review

The first executable covers signed transport, native identity/interaction authority, transport persistence, recovery and plugin packaging. Domain requirements remain explicitly assigned above, not claimed by fixture success. Interfaces share one verified event type and one host adapter; SQL and mutation ambiguity are tested rather than hidden by an exactly-once claim. All five review-focus failures map to task assertions. Live admission and private implementation material remain outside the public first-build deliverable.

## Organizational knowledge before grant drafting

Connect authorized read access to the DAO website as part of deployment, then retrieve governance, formation and applicant evidence with citations and access labels. Use that source first rather than asking for a manual applicant fact sheet. Resolve only remaining gaps with the user. Keep restricted records in scoped storage and prevent publication or contributor access beyond their audience.

## Website implementation handoff

The [members-only publication and authorized knowledge proposal](docs/integrations/dao-website-member-publication-proposal.md) specifies the website-side API, schema, membership checks, publication readback and grant-evidence retrieval contracts. It is a reviewed implementation proposal; the user owns website rollout.
