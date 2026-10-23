# Inertia specification

Revision: INERTIA-2026-10-23-r8
Updated: 2026-10-23 (UTC)
Stage: Connected rehearsal and native HTTP/API qualification passed; deployment and live domain adapters next.


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


## Reproducible connected walkthrough

From a development checkout with Node 24.11+ and dependencies installed, `npm run demo:workflow` prints the connected journey and writes `runs/workflow-receipt.json`. The receipt links the meeting revision/output hash, fixture-seeded native work, exact packet version/hash, paired acknowledgment and signed receipt. Reconstructing the bridge and replaying the same reply creates no second native mutation. External I/O is synthetic; ordinary acknowledgment remains separate from the grant governance evaluation. Website publication and unfinished live adapters remain explicitly pending.

Cloud is the default development and verification environment. Use the laptop only for a specific cloud blocker or required platform check; local Docker checks are reserved for a specific authorized fallback. Exact live-adapter inputs, outputs and acceptance checks are in [live handoff checklist](docs/implementation/live-handoff-checklist.md).

## 1. Product outcome

Inertia turns DAO conversation and source material into traceable work, lets members contribute spare agent capacity, and returns verified results to the same conversation. Paperclip is the operational platform. Buzz and the Paperclip dashboard are two entry points into the same hierarchy, tasks and decisions.

The required demo has three connected outcomes:
1. A Roundtable recording processed by Gemini reaches organization Drive; Inertia automatically publishes a cleaned transcript and separate notes to the DAO website and returns the resulting links.
2. The existing scanner finds a current grant opportunity; a reviewed application packet is frozen and a blockchain vote is bound to that exact packet.
3. Another DAO member connects an agent, which eagerly acquires eligible work, returns a validated contribution, and creates a justified follow-up when needed.

Y2 watches support the connected loop. Helix is de-prioritized. Form 990 enrichment is a known stretch goal. The proposed rehearsal buffer is October 29 ahead of the October 30 submission deadline; delivery planning is refined against compatibility results.

## 2. Operating model

### One authoritative work system

Deploy Paperclip as part of Inertia and connect the existing target Buzz instance. Website API/schema changes remain a proposal for the user’s rollout. Roundtable output belongs behind the members-only portal.

Paperclip owns agent identity and hierarchy, goals, issues, dependencies, assignment, run admission, checkout, workflow state, decisions, documents, budgets and audit. Buzz carries authenticated requests and presents the same task and decision IDs. Domain adapters attach source-specific evidence to native objects.

The CEO follows its native heartbeat: inspect goals, find actionable work, delegate, hire within configured policy, unblock agents, and report useful outcomes. Job acquisition is eager within each agent's authority, capabilities and budget. Follow-up tasks require a parent issue or goal, a concrete reason, acceptance criteria and a deduplication key. Dependencies express actual prerequisites; parent-child nesting alone does not enforce order.

A Buzz mention or workflow event must resolve to one Paperclip wake/issue operation. Disable overlapping autonomous schedulers for that work. A second UI must never maintain a competing approval or task ledger.

### Capability reuse matrix

| Responsibility | Reuse first | Inertia-specific work | Evidence |
|---|---|---|---|
| CEO, hierarchy, hiring | Paperclip agents, goals, hiring permissions, reporting lines | Configure DAO roles and hiring policy | CEO HEARTBEAT and create-agent skill |
| Work discovery and delegation | Native issues, parent/child issues, dependencies, wakeups, routines | Meeting/grant/Y2 producers and bounded follow-up policy | Issue and routine services |
| Exclusive execution | Native atomic checkout, assignee/run ownership, wake coalescing | Connector correlation and contract tests | Checkout and heartbeat services |
| Member execution | Native Runner and execution-environment plugin interfaces | Qualify existing execution hardening against selected release | Runner README; plugin runner execution contract |
| Workspace lifecycle | Native prepare, submit, reconcile, checkpoint, cleanup | Domain packet inputs and output validation | Runner launch preparation |
| Decisions and human interactions | Native questions, confirmations, approvals and review stages | Buzz rendering, identity pairing and on-chain packet adapter | SDK interactions; execution policy |
| Credentials and tool access | Native connections vault, scoped bindings, tool gateway | Configure least-privilege domain integrations | Connector playbook; MCP governance |
| Bidirectional chat | Native endpoint identity links, ingress ledger, publications and task bindings | Buzz provider or bounded plugin bridge | Chat connector UX and channel services |
| Documents and costs | Native revisions, attachments, costs, budget admission | Evidence packet schema and project limits | Native documents and budgets |
| Buzz remote agents | ACP runtimes, authenticated relay, prepared task launch | Select launch route consistent with one execution owner | Buzz ACP README and TASKS |

### Ownership boundary

Paperclip controls policy and accepted state. The selected runner and existing execution-hardening integration control execution isolation and workspace lifecycle. Member results are candidate evidence. A trusted domain adapter validates them and performs authorized external writes. Member runtimes receive only the task's authorized data and never receive shared publisher or grant-submission credentials.

Plugins execute trusted extension code. Runtime isolation, credential boundaries and host networking need qualification against the selected integration; an API surface or worktree alone is not the isolation boundary. Native budget admission is used together with bounded runtime/tool requests.

## 3. Buzz–Paperclip bridge contract

| Object or event | Required mapping and behavior |
|---|---|
| Conversation | Relay + channel + thread root resolve to one company endpoint and native issue/conversation binding. |
| Identity | A Buzz public key is explicitly paired to a Paperclip human member or agent. Agent attribution stays agent attribution. |
| Ingress | Persist Buzz event ID, origin, source revision and native object ID before side effects. Duplicate delivery returns the prior outcome. |
| Human decision | Render native interaction ID and version, available choices and scope. Recheck current membership and authorization when applying the answer. |
| Stale/conflicting answer | Return current authoritative state; never apply an answer to a different revision or silently overwrite an accepted decision. |
| Egress | Publish the result into the originating Buzz thread with native task/interaction links and an origin marker. |
| Echo prevention | The bridge's own publications cannot become new work requests. Replies remain correlated even after retries. |
| Recovery | Resume from persisted cursor and reconcile edits, deletions and uncertain publications before resending. |
| Audience | Preserve source and destination audience restrictions. Reject cross-company or cross-channel privilege expansion. |
| Execution | Exactly one scheduler/checkout owner controls each admitted job. Buzz ACP launch is a transport/runtime option, not a competing scheduler. |

Selected first route: a bounded TypeScript plugin bridge using the pinned SDK's paired-user comments and accept/reject interaction APIs. This avoids an upstream upgrade merely to obtain the newer native chat-provider framework. Preserve native IDs and authority; do not build a second task or decision ledger. Buzz owner attestations do not turn agent output into a human approval.

## 4. Domain requirements

### Meetings: R-M01–R-M04

Current DAO meeting actions verify a Privy login rather than active DAO membership. The required target is members-only portal publication, not public posting. Add and test explicit active-membership authorization and audience readback before publishing. Inertia supplies the website API/schema/contracts proposal; the user owns its rollout.

Current core uses source-grounded extractive quotes. It rejects model-supplied owners and labels model classifications unverified. The actual website publisher/readback adapter remains the next integration step; the contracts below define the complete target.

- R-M01: Observe authorized ready Meet/Gemini outputs in organization Drive. Identify meeting, source file, source revision and content hash; preserve originals and provenance.
- R-M02: Produce a faithful cleaned transcript separately from notes, decisions and action items. Preserve uncertainties and source links. A summary-only source yields notes and a missing-transcript exception, never an invented transcript.
- R-M03: Automatically upsert both outputs through the existing DAO publication interface under a versioned policy for source folders, document types, destination audience and retention. Routine in-policy meetings need no vote or per-meeting approval.
- R-M04: Read back content, URLs, version and audience. Deduplicate meeting/source versions, reconcile ambiguous writes, and version corrections. An exception becomes a native issue with actionable evidence.

Action-item extraction proposes native work with explicit source references. Unassigned names or ambiguous commitments stay unresolved rather than fabricated. Keep meeting text out of logs where not needed; retrieved text is data, never an instruction to change permissions or execute arbitrary actions.

### Grants: R-G01–R-G04

Vocdoni is selected, and the user will provide an example. The documented FWTX route suggests possible Aragon/final-action stages; verify which stages apply to the actual setup rather than mandating another platform. The configured verifier must establish the effective final result and exact packet binding. Confirm network and completed proposal evidence through U06.

The merged grant core reads a trusted export of engine-owned records and verifies artifact bytes before freezing the packet, version, review and hashes together. It requires a fresh source re-read and exact network/proposal/action/packet match from an injected governance verifier. Production integration supplies a consistent-read exporter, chain-specific verification and transactional acceptance on the native work item. The engine retains its existing review and manual submission handoff.

- R-G01: Reuse the existing scanner's acquisition, eligibility rules, matching, saved-result and drafting interfaces. Refresh opportunity data and record retrieval time, deadline and source URL.
- R-G02: Verify applicant eligibility and direct-versus-partner route. Create a cited, template-based draft, preserving human review and existing signoffs.
- R-G03: Freeze packet ID, version, canonical content hash, attachments and review record. A blockchain vote references exactly this immutable packet and its proposed action.
- R-G04: Validate chain/network, proposal identity, eligible result, finality and packet binding before applying voted authority. Changed content needs renewed authority. Actual funder submission is a separately controlled step.

Ordinary authorized research, drafts and website maintenance operate without a vote. The optional shortlist vote is not a dependency of the required final packet vote. Application assertions must be supported by approved DAO information. The DAO website is the intended authoritative organizational knowledge source, including governance rules and formation documents. The deployed agent retrieves these through authorized authenticated access before asking the user to re-enter facts. Preserve source URL/document ID, version or content hash, retrieval time, exact supporting passage and access classification with each claim. A page unavailable publicly is not evidence that the DAO lacks the record. Request only gaps that remain after authorized retrieval; restricted source material stays out of public artifacts and is not automatically shared with contributing agents.

### Member contribution: R-C01–R-C05

The user will arrange repository-admin access for a second rehearsal participant. Authorize that participant’s agent separately within the DAO application; repository permissions do not grant control-plane credentials or wider DAO privileges.

- R-C01: Pair a member and agent, verify membership and capabilities, and limit access to approved companies/projects/tasks.
- R-C02: Use native eager acquisition, checkout and dependency handling. Configure autonomy, hiring and budgets rather than granting them by job title.
- R-C03: Execute client-side using a qualified sandbox and isolated workspace, with narrowly scoped data and tools. The server validates artifact types, size, provenance and authorized state transition.
- R-C04: Recover interrupted work through native runner/plugin lifecycle and reconcile stale or duplicate results. Accept one authoritative completion per task revision.
- R-C05: Allow follow-up creation with parent context, reason, acceptance criteria and deduplication. Apply budget/depth/rate limits and retain human visibility in both UIs.

### Operations and Y2

- R-O01: Native operational state links source events, issues, runs, artifacts, decisions and external receipts. Configure retry limits, cancellation, budget admission and audit retention.
- R-Y01: Register a relevant grant/program/partner interest with Y2; map each relevant update to the existing issue or a deduplicated follow-up, retaining the originating interest and source reference.
- R-X01 (stretch): Enrich grant research with 990 Graph data, preserving source provenance and reviewing fit before adding a graph dependency.

## 5. Data and authority

Preserve DAO PlanetScale PostgreSQL and the scanner's existing data model. Paperclip owns work state; Buzz retains its own transport data. Integrations store references and mappings rather than duplicating full databases. Use native connection/credential facilities and scoped capability bindings before introducing another secret store. Cloudflare may provide hosting, access or event transport after the service choice is confirmed.

A blockchain vote and a Paperclip workflow approval are separate evidence types. A native approval can coordinate work; voted DAO authority additionally requires the immutable packet and chain result. A changed packet invalidates reuse of the earlier vote. Private documents are not uploaded to public or content-addressed storage merely because a URL is available.

## 6. Acceptance

The demo evidence package contains: source-to-publication trace and readback; current grant sources, reviewed packet and bound vote receipt; a second member's successful contribution and denied unauthorized action; identical task/decision state in Buzz and dashboard; and recovery evidence for duplicate ingress and reconnect. See testing.md for precise fixtures and expected outcomes.

## 7. Design progression

The settled choices in decisions.md stand. Build the thin bridge now using signed fixtures and public SDK contracts. Resolve live access/admission separately while domain adapters proceed against explicit contracts. Existing hardened execution remains the reuse path; the bridge does not implement a sandbox or scheduler.

## 8. First build: a real, small bridge

### Experience

One-time pairing and channel binding are administrator setup. Thereafter members reply in their existing Buzz thread or use the Paperclip dashboard, without moving task IDs between tools. A decision card gives context and a clear accept/reject action; the result appears in the same thread. Normal successful processing is quiet. A recoverable disconnect heals automatically; an unresolved action shows one actionable status with a retry or configuration instruction, not repeated stack traces. Operator health reports connection, backlog and oldest pending item, last successful sync, and the precise next action when blocked. No additional dashboard is built.

The initial executable delivers signed Buzz ingress → native human comment or accept/reject decision → signed Buzz receipt, plus native interaction → Buzz decision prompt. It runs end to end with realistic fixture services. Production connection settings and pairing records are injected by the trusted host. Live key creation, grants, provisioning and deployment are separate operational steps.

### Regular Paperclip upgrades

Target the latest Paperclip release that passes qualification. Version pins identify a reproducible security/build evaluation and release artifact, rather than a permanent platform constraint. Maintain a small version manifest with host/SDK versions, source/package integrity, plugin version and schema state. For each candidate, run compatibility tests, clean package installation, native-service checks and full-host smoke tests in a disposable environment. Review changed capabilities and migrations, exercise the existing database upgrade path, then promote the tested artifact through the normal deployment process.

Keep the previous artifact and a verified pre-upgrade database backup. Rehearse recovery by restoring the compatible backup and previous runtime together; binary downgrade alone cannot reverse database migrations. Record the upgrade result and one useful operator action if qualification fails. The implemented checker and isolated qualification commands are described in [Paperclip upgrades](docs/qualification/paperclip-upgrades.md): `node scripts/paperclip-upgrade.mjs` refreshes release metadata, and `node scripts/paperclip-upgrade.mjs --qualify` runs the disposable SDK/package qualification. Native/full-host candidate checks and tested database recovery remain promotion gates. No live auto-upgrade or recurring schedule has been enabled.

### Baseline and implementation

Use TypeScript ESM on Node 24.11+, npm lockfile, Vitest, and nostr-tools for Nostr cryptography. Compile the plugin manifest and native adapter against the public Paperclip SDK from v2026.1012.0, commit bba6a45f0d364cfd962ac59b3bdf2426a8222adb. Use the public registry package @paperclipai/plugin-sdk@2026.1012.0 and record its integrity; its release version differs from the source package.json version 1.0.0. Compile against the published artifact and audit compatibility with the source pin rather than assuming byte identity. Upgrade the host/SDK together through the qualification process; keep each tested build reproducible and avoid copying private vendor trees. Keep the source pin and package integrity together in docs/bridge-state-contract.md. Buzz wire baseline is dc25198d530acc6237a0320b697365f29daf0ea6.

Reuse ctx.issues.createComment, listComments, listInteractions and respondInteraction. The host checks current human company membership. A human-attributed comment already participates in native assignee wakes; the bridge adds no extra wake. Initial direct decisions support accept/reject for immutable plain confirmations. Target-bound or structured decisions open their native Paperclip UI. Structured question answers, hiring decisions and blockchain ratification remain distinct adapters, not guessed meanings of an emoji. The plugin exports a real SDK manifest and worker entrypoint with capability declarations and native health reporting.

### Wire and identity

- Accept only structurally valid Nostr messages whose ID and Schnorr signature verify against canonical event bytes. No inbound flag such as verified=true is trusted.
- Derive the author from the signed public key. Resolve a trusted pairing scoped to the configured relay and company. Incoming actorUserId/companyId fields cannot select authority.
- Derive channel and thread from unambiguous signed tags. Unknown, conflicting, unbound or foreign destinations fail closed. Event kind 9 is the initial supported conversational input. Reject auxiliary/moderation kinds as commands.
- Pairing distinguishes human and agent. Unknown/revoked identities cannot write; agents cannot use the human decision path, even with owner attestation.
- Bind relay+channel+root to a native issue and company in host-controlled configuration. A signed command cannot redirect that binding.
- Use POST /query for reads and POST /events for publishing. Authenticate with fresh NIP-98 events, kind 27235, binding exact URL, HTTP method and SHA-256 request body. Disable redirects. Permit only the configured HTTPS relay origin (loopback HTTP only in test mode).
- Outbound event signing is injected through a signer; persist the signed event before delivery. Retry the same event ID, with fresh HTTP authentication. Incoming bridge-authored events and known outbox IDs never trigger native work.
- Render an interaction's native ID plus a random opaque card token. Store the token's company, issue, interaction and rendered-content digest. A reply must match that binding and current interaction content. New/replaced content produces a new card. Accept/reject commands are deterministic, not LLM interpretation of an ambiguous reply.

Initial text fallback: normal replies in a bound issue thread become comments; decision prompts include `/inertia accept <card-token>` and `/inertia reject <card-token>`. Malformed or unknown `/inertia` commands return short guidance rather than becoming comments. Existing Buzz buttons can later map to the same verified command without changing authorization.

### Persistence and reconciliation

Use the plugin's namespaced PostgreSQL database via ctx.db, with migrations for bridge bindings, pairings, inbox receipts, decision-card bindings, and outbox records. These are transport records, never a duplicate work queue. SQL parameters carry all values; namespace is the host-provided validated identifier. Use unique keys and compare-and-set transitions, not get-then-set deduplication. A lightweight PostgreSQL-compatible fixture database may execute the same migration/queries in tests; report its scope accurately.

Inbox key is (relay, eventId). States are received, applying, applied, rejected, and uncertain. Claim with a conditional write before host mutation. Applied/rejected duplicates return the saved result. Persist the destination and deterministic receipt key with the result; an outbox repair pass reconstructs a missing receipt from an applied row after a crash. Only one claimant enters applying. An expired claim must not blindly repeat a potentially committed mutation.

Native comments have no assumed idempotency key: include a stable source-event correlation marker in the comment and reconcile listComments after a lost response. If a matching comment exists, save its native ID; if the previous request may still complete, retain uncertain and do not issue a second create. Native interactions return applied=false when already resolved; render the authoritative result, never claim the requested opposite action won. Before resolving, reread the interaction and enforce card binding. Use the host's atomic resolution as final authority. If the chosen host allows pending interaction content mutation without compare-and-set, disable direct resolution for that case and link to the native card until a safe API exists.

Outbox states are pending, delivered and blocked. A lost publish response retries the same signed event; relay event-ID deduplication converges. Use bounded exponential backoff with jitter for transport failures and 429/5xx, respect Retry-After, and surface permanent 4xx/configuration failures once. Native plugin jobs/events drive reconciliation; do not create a job scheduler. Cursors advance only after each fetched event has a durable disposition. Recheck a bounded recent lookback for delayed events, deduplicate by event ID, and persist resumable historical backfill. Isolate future-dated events so they cannot move the checkpoint beyond legitimate traffic. Scope health and recovery to the configured company; addressed confirmation cards stay with their authorized audience. Source edits/deletes become linked correction/tombstone evidence; they never retroactively reverse an accepted native decision.

### Boundary contracts for following slices

- MeetingSource: meetingId, sourceId, revision, sha256, observedAt, audience, sourceUrl, transcript-or-summary classification. Publisher upsert/readback returns publicationId, revision, URLs, audience and verified hash.
- GrantOpportunity: scanner source ID, URL, retrievedAt, deadline, eligibility evidence, applicant route. PacketManifest: packetId, version, canonical hash, attachment hashes, review/signoff references. VoteReceipt binds network, proposal, action, packet hash and finality evidence.
- Contribution: native issue/run/checkout identity, member principal, allowed input references, output manifest and provenance. A trusted adapter accepts outputs through existing execution lifecycle and native review; member machines never receive control-plane broker credentials.
- Y2Update: subscription/interest ID, external event ID, source URL, revision and relevance evidence. Native issue bindings and deduplication prevent repeated tasks.

These contracts preserve the full product while the first executable establishes the shared interaction path. Implement adapters against actual source interfaces before connecting live services.

## Source baseline

Source inspection on 22 October 2026 established these native capabilities. Deployment qualification is the next evidence gate.

- Paperclip: [341b622604b639b056fc58b10e2dd3312d40385c](https://github.com/paperclipai/paperclip/tree/341b622604b639b056fc58b10e2dd3312d40385c).
- Buzz: [dc25198d530acc6237a0320b697365f29daf0ea6](https://github.com/block/buzz/tree/dc25198d530acc6237a0320b697365f29daf0ea6).
- DAO website: [FWTX-DAO repositories](https://github.com/orgs/FWTX-DAO/repositories); user-confirmed PlanetScale PostgreSQL and Meet/Gemini/organization Drive workflow.
- Existing scanner: [NetRxn/DFW-Gov-Fund](https://github.com/NetRxn/DFW-Gov-Fund), 3.4.0 interface baseline; qualify the selected runnable version.
- [Y2](https://y2.dev/) is teammate-owned and remains an integration objective.
- [Texas Nova](https://texas-nova.labs.fwtx.city/) and [990 Graph](https://990-g2.ntx.labs.fwtx.city/login) are contextual resources; 990 enrichment is stretch.

## Artifact coordination

The synchronized set is [spec.md](spec.md), [testing.md](testing.md), [decisions.md](decisions.md), [plan.md](plan.md), and [Inertia-Architecture.pptx](Inertia-Architecture.pptx). Update the common revision whenever new user decisions change the design. Keep stable filenames and Library identities. The original [product overview](docs/reference/Inertia-beta-product-overview.pdf) remains byte-identical historical material. Current decisions supersede its older sequencing. External configuration questions are centralized in decisions.md.

## Website implementation handoff

The [members-only publication and authorized knowledge proposal](docs/integrations/dao-website-member-publication-proposal.md) specifies the website-side API, schema, membership checks, publication readback and grant-evidence retrieval contracts. It is a reviewed implementation proposal; the user owns website rollout.
