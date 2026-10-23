# Inertia specification

Revision: INERTIA-2026-10-23-r11
Updated: 2026-10-23 (UTC)
Status: runtime unchanged; native-first grant integration planned.


## Implementation status

Documentation baseline: develop `778996e9`. Runtime: PR 17 merged at `4841f7ade1510acf93e43ce1dbd16b91ae7bcd88`.

| Component | Verified state | Remaining integration |
|---|---|---|
| Buzz bridge | Signed transport, native comments/confirmations, durable recovery | Approved relay, pairing and live admission |
| Native comment export | First-publication mirroring, default-off | Per-binding audience approval and history cutoff; status mirroring planned |
| Roundtable | Source/hash core and website caller contract-tested | Website server, authorized Drive source and single-owner native job |
| Grants | Packet/review/vote binding core; native review primitives source-verified | Scoped skill/tool harness, trusted human-decision/domain adapter, effective-authority verifier and native receipt acceptance |
| CEO | Native operator checklist | Assigned intake mandate, native run policy, budgets and authorized pilot |
| Member agents and Y2 | Interfaces identified | Enrollment, execution isolation and live adapters |

Qualification: 248 combined tests; exact archive passed native-service RPC checks with six migrations. [Testing evidence](testing.md#qualification-record) identifies the artifact and acceptance scope. Live deployment and domain admission are pending. Website server contract: [v1 proposal](docs/integrations/dao-website-member-publication-proposal.md), [v1.1 clarification](docs/integrations/dao-website-publication-v1.1-clarifications.md).

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

### Native ownership

Deploy Paperclip as part of Inertia and connect the existing target Buzz instance. Website API/schema changes remain a proposal for the user’s rollout. Roundtable output belongs behind the members-only portal.

Paperclip owns agent identity and hierarchy, goals, issues, dependencies, assignment, run admission, checkout, workflow state, decisions, documents, budgets and audit. Buzz carries authenticated requests and presents the same task and decision IDs. Domain adapters attach source-specific evidence to native objects.

Configure the CEO with an explicitly assigned intake mandate and native heartbeat: inspect that assigned intake, delegate, hire within configured policy, unblock agents, and report useful outcomes. Native CEO behavior does not scan arbitrary unassigned work by default; an intake mandate must define its scope, authority and acceptance criteria. Job acquisition is eager within each agent's authority, capabilities and budget. Follow-up tasks require a parent issue or goal, a concrete reason, acceptance criteria and a deduplication key. Dependencies express actual prerequisites; parent-child nesting alone does not enforce order.

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

Paperclip controls policy and accepted state. The selected runner and existing execution-hardening integration control execution isolation and workspace lifecycle. Member results are candidate evidence. A trusted domain adapter validates them and performs authorized external writes. Member runtimes receive only the task's authorized evidence and scoped proposal tools, never the organization database, database-admin/reviewer keys, shared publisher credentials, portal credentials or human-decision tools.

Plugins execute trusted code. Qualify runtime isolation, credentials and host networking separately from workspace isolation. Combine native budget admission with bounded runtime/tool requests.

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

Selected route: a TypeScript plugin using the qualified SDK’s paired-user comment and accept/reject APIs. Retain native task/decision IDs and authority. Agent messages remain agent-authored, including messages with owner attestations.

## 4. Domain requirements

### Meetings: R-M01–R-M04

Website reads currently require Privy login. Members-only publication requires active-membership checks and audience readback. Inertia supplies the API/schema proposal; the user owns website rollout.

Current core uses source-grounded extractive quotes. It rejects model-supplied owners and labels model classifications unverified. The caller-side website publisher/readback adapter is merged and contract-tested. The website server contract remains proposed and source readiness, durable native job wiring and live admission are still pending; the contracts below define the complete target.

- R-M01: Observe authorized ready Meet/Gemini outputs in organization Drive. Identify meeting, source file, source revision and content hash; preserve originals and provenance.
- R-M02: Produce a faithful cleaned transcript separately from notes, decisions and action items. Preserve uncertainties and source links. A summary-only source yields notes and a missing-transcript exception, never an invented transcript.
- R-M03: Automatically upsert both outputs through the existing DAO publication interface under a versioned policy for source folders, document types, destination audience and retention. Routine in-policy meetings need no vote or per-meeting approval.
- R-M04: Read back content, URLs, version and audience. Deduplicate meeting/source versions, reconcile ambiguous writes, and version corrections. An exception becomes a native issue with actionable evidence.

Action-item extraction proposes native work with explicit source references. Unassigned names or ambiguous commitments stay unresolved rather than fabricated. Keep meeting text out of logs where not needed; retrieved text is data, never an instruction to change permissions or execute arbitrary actions.

The [public integration map](docs/implementation/public-dao-integration-map.md) records Meeting Mode, linked DeGov/Vocdoni services and proposed governance. Verify deployed ballot support and operative thresholds. Keep publication and motion approval separate.

### Grants: R-G01–R-G04

Vocdoni is selected, and the user will provide an example. The [documented FWTX route](https://documentation.robsrulesdao.com/aragon) suggests possible Aragon/final-action stages; verify which stages apply to the actual setup rather than mandating another platform. The configured verifier must establish the effective final result and exact packet binding. Confirm network and completed proposal evidence through U06.

**Native-first target; integration not implemented.** Scout and application-drafting agents run in Paperclip using the existing funding skill and CLI/MCP harness, centrally or in scoped member environments. Paperclip owns tasks, documents, questions and human review cards. The funding backend retains evidence, validated proposals, immutable packets, eligibility and review audit. Its web UI is an optional specialist/admin fallback, not a required workflow boundary.

Use native per-item verdicts with explicit `resolverPolicy: human_only`, configured addressees and current document-revision targets. A **planned trusted server adapter** verifies the authenticated human, designated role, company/applicant, workspace and packet version, then applies existing funding-domain review operations. Current funding MCP does not expose proposal acceptance or packet signoff; agents have neither permission. Initially, corrections use document edit → regenerated proposal → new review. Add a structured grant panel only if a real packet walkthrough proves that path insufficient.

The merged packet core already verifies exact artifact bytes and freezes packet, version and reviews. `ReviewedGrantSource` is a trusted domain read adapter, not a mandatory export from a separate UI or an existing HTTP endpoint. Production still needs consistent reads, durable decision/domain reconciliation, chain-specific verification and native receipt acceptance. A native decision is not a DAO vote, and neither submits to a funder. See the [source-pinned mapping](docs/reference/native-grant-workflow.md) and [adapter contract](docs/development/native-grant-workflow.md).

- R-G01: Reuse the existing scanner's acquisition, eligibility rules, matching, saved-result and drafting interfaces. Refresh opportunity data and record retrieval time, deadline and source URL.
- R-G02: Verify applicant eligibility and direct-versus-partner route. Create cited drafts through the shared harness; collect native human-only review with authenticated role mapping while preserving funding-domain validation and signoffs.
- R-G03: Freeze packet ID, version, canonical content hash, attachments and review record. A blockchain vote references exactly this immutable packet and its proposed action.
- R-G04: Validate chain/network, proposal identity, eligible result, finality and packet binding before applying voted authority. Changed content needs renewed authority. Actual funder submission is a separately controlled step.

Ordinary authorized research, drafts and website maintenance need no vote. The required final packet vote is independent of an optional shortlist vote. Application assertions must be supported by approved DAO information. The DAO website is the intended authoritative organizational knowledge source, including governance rules and formation documents. The deployed agent retrieves these through authorized authenticated access before asking the user to re-enter facts. Preserve source URL/document ID, version or content hash, retrieval time, exact supporting passage and access classification with each claim. Establish source gaps through authorized retrieval. Keep restricted material out of public artifacts and outside contributors’ authorized data scope.

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

The bridge is merged. Complete live admission and domain adapters against the contracts below, reusing native scheduling and the existing hardened execution integration.

## 8. Bridge implementation

### Experience

One-time pairing and channel binding are administrator setup. Thereafter members reply in their existing Buzz thread or use the Paperclip dashboard, without moving task IDs between tools. A decision card gives context and a clear accept/reject action; the result appears in the same thread. Normal successful processing is quiet. A recoverable disconnect heals automatically; an unresolved action shows one actionable status with a retry or configuration instruction, not repeated stack traces. Operator health reports connection, backlog and oldest pending item, last successful sync, and the precise next action when blocked. No additional dashboard is built.

The initial executable delivers signed Buzz ingress → native human comment or accept/reject decision → signed Buzz receipt, plus native interaction → Buzz decision prompt. It runs end to end with realistic fixture services. Production connection settings and pairing records are injected by the trusted host. Live key creation, grants, provisioning and deployment are separate operational steps.

### Regular Paperclip upgrades

Target the latest Paperclip release that passes qualification. Version pins identify reproducible evaluation and release artifacts. Maintain a small version manifest with host/SDK versions, source/package integrity, plugin version and schema state. For each candidate, run compatibility tests, clean package installation, native-service checks and full-host smoke tests in a disposable environment. Review changed capabilities and migrations, exercise the existing database upgrade path, then promote the tested artifact through the normal deployment process.

Keep the previous artifact and a verified pre-upgrade database backup. Rehearse recovery by restoring the compatible backup and previous runtime together; binary downgrade alone cannot reverse database migrations. Record the upgrade result and one useful operator action if qualification fails. The implemented checker and isolated qualification commands are described in [Paperclip upgrades](docs/qualification/paperclip-upgrades.md): `node scripts/paperclip-upgrade.mjs` refreshes release metadata, and `node scripts/paperclip-upgrade.mjs --qualify` runs the disposable SDK/package qualification. Native/full-host candidate checks and tested database recovery remain promotion gates. Live auto-upgrades: disabled.

### Baseline and implementation

Use TypeScript ESM on Node 24.11+, npm lockfile, Vitest, and nostr-tools for Nostr cryptography. Compile the plugin manifest and native adapter against the public Paperclip SDK from v2026.1012.0, commit bba6a45f0d364cfd962ac59b3bdf2426a8222adb. Use the public registry package @paperclipai/plugin-sdk@2026.1012.0 and record its integrity; its release version differs from the source package.json version 1.0.0. Compile against the published artifact and audit compatibility with the source pin rather than assuming byte identity. Upgrade the host/SDK together through the qualification process; keep each tested build reproducible and avoid copying private vendor trees. Keep the source pin and package integrity together in docs/bridge-state-contract.md. Buzz wire baseline is dc25198d530acc6237a0320b697365f29daf0ea6.

Reuse ctx.issues.createComment, listComments, listInteractions and respondInteraction. The host checks current human company membership. A human-attributed comment already participates in native assignee wakes; the bridge adds no extra wake. Initial direct decisions support accept/reject for immutable plain confirmations. Target-bound or structured decisions open their native Paperclip UI. Structured questions, hiring and blockchain ratification require their own typed adapters. The plugin exports a real SDK manifest and worker entrypoint with capability declarations and native health reporting.

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

Delivery states include pending, publishing, delivered, blocked and suppressed. Native comments use non-expiring publication claims; see [comment recovery](docs/native-comment-mirroring.md#concurrency-and-interrupted-publication). A lost publish response retries the same signed event; relay event-ID deduplication converges. Use bounded exponential backoff with jitter for transport failures and 429/5xx, respect Retry-After, and surface permanent 4xx/configuration failures once. Native plugin jobs/events drive reconciliation; do not create a job scheduler. Cursors advance only after each fetched event has a durable disposition. Recheck a bounded recent lookback for delayed events, deduplicate by event ID, and persist resumable historical backfill. Isolate future-dated events so they cannot move the checkpoint beyond legitimate traffic. Scope health and recovery to the configured company; addressed confirmation cards stay with their authorized audience. Source edits/deletes become linked correction/tombstone evidence; they never retroactively reverse an accepted native decision.

### Boundary contracts for following slices

- MeetingSource: meetingId, sourceId, revision, sha256, observedAt, audience, sourceUrl, transcript-or-summary classification. Publisher upsert/readback returns publicationId, revision, URLs, audience and verified hash.
- GrantOpportunity: scanner source ID, URL, retrievedAt, deadline, eligibility evidence, applicant route. PacketManifest: packetId, version, canonical hash, attachment hashes, review/signoff references. VoteReceipt binds network, proposal, action, packet hash and finality evidence.
- Contribution: native issue/run/checkout identity, member principal, allowed input references, output manifest and provenance. A trusted adapter accepts outputs through existing execution lifecycle and native review; member machines never receive control-plane broker credentials.
- Y2Update: subscription/interest ID, external event ID, source URL, revision and relevance evidence. Native issue bindings and deduplication prevent repeated tasks.

These contracts preserve the full product while the first executable establishes the shared interaction path. Implement adapters against actual source interfaces before connecting live services.

## Source baseline

Source inspection baselines, 22 October 2026. Exact runtime qualification is recorded in [testing.md](testing.md#qualification-record).

- Paperclip: [341b622604b639b056fc58b10e2dd3312d40385c](https://github.com/paperclipai/paperclip/tree/341b622604b639b056fc58b10e2dd3312d40385c).
- Buzz: [dc25198d530acc6237a0320b697365f29daf0ea6](https://github.com/block/buzz/tree/dc25198d530acc6237a0320b697365f29daf0ea6).
- DAO website: [FWTX-DAO repositories](https://github.com/orgs/FWTX-DAO/repositories); user-confirmed PlanetScale PostgreSQL and Meet/Gemini/organization Drive workflow.
- Existing scanner: [NetRxn/DFW-Gov-Fund](https://github.com/NetRxn/DFW-Gov-Fund), 3.4.0 interface baseline; qualify the selected runnable version.
- [Y2](https://y2.dev/) is teammate-owned and remains an integration objective.
- [Texas Nova](https://texas-nova.labs.fwtx.city/) and [990 Graph](https://990-g2.ntx.labs.fwtx.city/login) are contextual resources; 990 enrichment is stretch.

## Related artifacts

[Specification](spec.md) · [Tests](testing.md) · [Decisions](decisions.md) · [Plan](plan.md) · [Editable architecture](Inertia-Architecture.pptx). Original [product overview](docs/reference/Inertia-beta-product-overview.pdf) retained unchanged.

## Website implementation handoff

The [members-only publication and authorized knowledge proposal](docs/integrations/dao-website-member-publication-proposal.md) specifies the website-side API, schema, membership checks, publication readback and grant-evidence retrieval contracts. It is a reviewed implementation proposal; the user owns website rollout.
