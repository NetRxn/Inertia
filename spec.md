# Inertia specification

Revision: INERTIA-2026-10-24-r18
Updated: 2026-10-24 (UTC)
Status: Public drafting/gaps, Task 6, partner graph, cloud qualification/race fixes and objective intake/briefs are merged. Real PostgreSQL, native-service and embedded-Helix cloud rehearsal and the synthetic meeting-answer loop passed independent review. The durable native acceptance core is implemented and independently reviewed, with DFW PR50 and Inertia host PR31 merged; it remains non-live pending production composition and qualification. Meeting source/native composition is merged in PR34 and independently qualified, default-disabled. The discovery foundation and source-bound funding facts are merged in Inertia PR35/36 and DFW PR51/52; live activation remains pending. The member candidate-only boundary is merged in PR37 and independently qualified. Daily recurring scouting remains disabled.


## Implementation status

Runtime/documentation base: develop `3064018359e986a0b69bb5c860c01bb18dd7f5b9` ([PR37](https://github.com/NetRxn/Inertia/pull/37)), including meeting PR34, discovery PR35, source-bound funding facts PR36 and the inactive member candidate boundary. The non-live durable host bundle remains merged in PR31. DFW durable acceptance is merged at `331416c015c83d20ea2d6834e5b4dd53aaeea320` ([PR50](https://github.com/NetRxn/DFW-Gov-Fund/pull/50)). The historical PR17 archive retains its exact qualification record.

| Component | Verified state | Remaining integration |
|---|---|---|
| Buzz bridge | Signed transport, native comments/confirmations, durable recovery | Approved relay, pairing and live admission |
| Native comment export | First-publication mirroring, default-off | Per-binding audience approval and history cutoff; status mirroring planned |
| Roundtable | Source adapter, durable single-owner native job and reference-only follow-up merged in PR34; native PostgreSQL/WAL qualification passed, default-disabled | Real Drive/website admission, live capability review, retention/recovery and transport qualification; notes-only website contract (R-M02 partial) |
| Grants | Public drafting/actionable gaps and packet/review/vote binding merged; durable DFW acceptance merged and native capture independently qualified, non-live | Qualify production route/transport, retention/archive, roles/bindings/source access, writer fence, human correction/cancel walkthrough, actual model harness and effective-authority verification |
| Reusable knowledge and finance | Task 6 evidence/SQL reuse and sanitized financial contracts merged; real PostgreSQL domain qualification passed | Configure trusted production import/admission, roles and the selected financial adapter |
| Partner graph | Typed assertions, writeback/outbox and scoped projection/query core merged; real PG-to-embedded-Helix rehearsal passed | Qualify authenticated production adapters, admitted inventory/backfill, deployed Helix and operational discovery |
| October discovery | Selected-scope acquisition complete; PR42 merged with passing post-merge CI; priority diligence queue delivered | Select preparation under current owner priorities and deferrals from the [reviewed queue](https://github.com/NetRxn/DFW-Gov-Fund/blob/main/government-funding-dfw/docs/discovery/2026-10-23-priority-diligence.md), preserving confidence and source limits |
| Operational discovery | Foundation and source-bound funding facts merged in Inertia PR35/36 and DFW PR51/52; native/cold-DFW qualification passed | Actual research/model tools, responsible-member wake mapping, human Buzz delivery and recurrence admission |
| CEO | Objective intake, funding links and meeting-ready brief core merged; synthetic meeting-answer loop passed | Assign the live intake/research mandate, source access, tools, budgets and delivery policy |
| Member agents | Candidate-only admission, scoped inputs, artifact validation and immutable replay receipts merged in PR37; independently qualified | Engineering-owned authenticated ingress/attempt authority, live enrollment/provider execution, native review handoff and authoritative completion |
| Y2 | Interface identified | Authorized contract and live adapter |

Historical PR17 qualification: 248 combined tests; its exact archive passed native-service RPC checks with six migrations. Current cloud and Task 8 evidence is recorded separately. [Testing evidence](testing.md#qualification-record) identifies the artifact and acceptance scope. Live deployment and domain admission are pending. Website server contract: [v1 proposal](docs/integrations/dao-website-member-publication-proposal.md), [v1.1 clarification](docs/integrations/dao-website-publication-v1.1-clarifications.md).

## Reproducible connected walkthrough

From a development checkout with Node 24.11+ and dependencies installed, `npm run demo:workflow` prints the connected journey and writes `runs/workflow-receipt.json`. The receipt links the meeting revision/output hash, fixture-seeded native work, exact packet version/hash, paired acknowledgment and signed receipt. Reconstructing the bridge and replaying the same reply creates no second native mutation. External I/O is synthetic; ordinary acknowledgment remains separate from the grant governance evaluation. Website publication and unfinished live adapters remain explicitly pending.

Cloud is the default development and verification environment. Use the laptop only for a specific cloud blocker or required platform check; local Docker checks are reserved for a specific authorized fallback. Exact live-adapter inputs, outputs and acceptance checks are in [live handoff checklist](docs/implementation/live-handoff-checklist.md).

## 1. Product outcome

Inertia turns DAO conversation and source material into traceable work, lets members contribute spare agent capacity, and returns verified results to the same conversation. Paperclip is the operational platform. Buzz and the Paperclip dashboard are two entry points into the same hierarchy, tasks and decisions.

The required demo has three connected outcomes:
1. A Roundtable recording processed by Gemini reaches organization Drive; Inertia automatically publishes a cleaned transcript and separate notes to the DAO website and returns the resulting links.
2. The existing scanner finds a current grant opportunity; a reviewed application packet is frozen and a blockchain vote is bound to that exact packet.
3. Another DAO member connects an agent, which eagerly acquires eligible work, returns a validated contribution, and creates a justified follow-up when needed.

The maintained Helix partner/people graph and query-first research writeback are core to the grant outcome. The demo must reuse an existing partner, save useful discoveries and retrieve them on the next run. Y2 watches support this connected loop. Broader Form 990 enrichment and optional vector/semantic search follow later. The proposed rehearsal buffer is October 29 ahead of the October 30 submission deadline; verify the operational graph and existing three outcomes against that target.

## 2. Operating model

### Native ownership

Deploy Paperclip as part of Inertia and connect the existing target Buzz instance. Website API/schema changes remain a proposal for the user’s rollout. Roundtable output belongs behind the members-only portal.

Paperclip owns agent identity and hierarchy, goals, issues, dependencies, assignment, run admission, checkout, workflow state, decisions, documents, budgets and audit. Buzz carries authenticated requests and presents the same task and decision IDs. Domain adapters attach source-specific evidence to native objects.

Configure the CEO with an explicitly assigned intake mandate and native heartbeat: inspect that assigned intake, delegate, hire within configured policy, unblock agents, and report useful outcomes. The CEO operates within an assigned intake mandate defining scope, authority and acceptance criteria. Job acquisition is eager within each agent's authority, capabilities and budget. Follow-up tasks require a parent issue or goal, a concrete reason, acceptance criteria and a deduplication key. Explicit dependencies enforce prerequisite order; parent-child links organize related work.

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
| Execution | Exactly one scheduler/checkout owner controls each admitted job. Buzz ACP launch supplies transport/runtime access under that scheduler. |

Selected route: a TypeScript plugin using the qualified SDK’s paired-user comment and accept/reject APIs. Retain native task/decision IDs and authority. Agent messages remain agent-authored, including messages with owner attestations.

## 4. Domain requirements

### Meetings: R-M01–R-M04

Website reads currently require Privy login. Members-only publication requires active-membership checks and audience readback. Inertia supplies the API/schema proposal; the user owns website rollout.

Current core uses source-grounded extractive quotes. It rejects model-supplied owners and labels model classifications unverified. [Meeting source/native composition](docs/development/meeting-source-native-composition.md) is merged and independently qualified: explicit Meet/Drive readiness, versioned publication recovery and reference-only native follow-up. The manual job remains default-disabled. R-M02 is partial: summary-only sources create missing-transcript work and retain their protected Drive reference, but notes-only website output needs a server contract. Real source/website admission and production qualification remain pending.

- R-M01: Observe authorized ready Meet/Gemini outputs in organization Drive. Identify meeting, source file, source revision and content hash; preserve originals and provenance.
- R-M02: Produce a faithful cleaned transcript separately from notes, decisions and action items. Preserve uncertainties and source links. A summary-only source yields notes and a missing-transcript exception, never an invented transcript.
- R-M03: Automatically upsert both outputs through the existing DAO publication interface under a versioned policy for source folders, document types, destination audience and retention. Routine in-policy meetings need no vote or per-meeting approval.
- R-M04: Read back content, URLs, version and audience. Deduplicate meeting/source versions, reconcile ambiguous writes, and version corrections. An exception becomes a native issue with actionable evidence.

Action-item extraction proposes native work with explicit source references. Retain unresolved owners and ambiguous commitments for clarification. Log only required meeting metadata. Treat retrieved text as data and enforce permissions and executable instructions through trusted policy.

The [public integration map](docs/implementation/public-dao-integration-map.md) records Meeting Mode, linked DeGov/Vocdoni services and proposed governance. Verify deployed ballot support and operative thresholds. Keep publication and motion approval separate.

### Grants: R-G01–R-G04

Vocdoni is selected, and the user will provide an example. The [documented FWTX route](https://documentation.robsrulesdao.com/aragon) suggests possible Aragon/final-action stages; verify the stages required by the actual setup. The configured verifier must establish the effective final result and exact packet binding. Confirm network and completed proposal evidence through U06.

**Native-first target; integration pending.** Scout and application-drafting agents run in Paperclip using the existing funding skill and CLI/MCP harness, centrally or in scoped member environments. Paperclip owns tasks, documents, questions and human review cards. The funding backend retains evidence, validated proposals, immutable packets, eligibility and review audit. Its web UI remains an optional specialist/admin fallback.

Use native per-item verdicts with explicit `resolverPolicy: human_only`, configured addressees and current document-revision targets. A **tested, default-disabled trusted server adapter** verifies the authenticated human, designated role, company/applicant, workspace and packet version, then applies existing funding-domain review operations. Current funding MCP exposes evidence and proposal tools only. Proposal acceptance and packet signoff require authorized human decisions through trusted domain services. Initially, corrections use document edit → regenerated proposal → new review. Add a structured grant panel only if a real packet walkthrough proves that path insufficient.

The durable successor captures authority for one exact command/version atomically with the native verdict. Later native role/membership changes, document edits, card withdrawal or disconnect do not revoke that instruction. Explicit cancellation takes effect only when DFW confirms it; an already-applied effect is not undone. Current DFW authorization, evidence, head and artifact checks still block stale effects, and submission authority remains separate. The core is implemented and independently reviewed; production route/transport, lifecycle-compatible retention/archive, real role/binding/source access, qualified writer fencing and a human correction/cancel walkthrough remain activation gates. The legacy adapter stays default-disabled.

The merged packet core already verifies exact artifact bytes and freezes packet, version and reviews. `ReviewedGrantSource` reads engine-owned domain data through a trusted adapter. Production still needs consistent reads, durable decision/domain reconciliation, chain-specific verification and native receipt acceptance. Native review, DAO ratification and funder submission have separate authority steps. See the [source-pinned mapping](docs/reference/native-grant-workflow.md) and [adapter contract](docs/development/native-grant-workflow.md).

- R-G01: Reuse the existing scanner's acquisition, eligibility rules, matching, saved-result and drafting interfaces. Refresh opportunity data and record retrieval time, deadline and source URL.
- R-G02: Verify applicant eligibility and direct-versus-partner route. Create cited drafts through the shared harness; collect native human-only review with authenticated role mapping while preserving funding-domain validation and signoffs.
- R-G03: Freeze packet ID, version, canonical content hash, attachments and review record. A blockchain vote references exactly this immutable packet and its proposed action.
- R-G04: Validate chain/network, proposal identity, eligible result, finality and packet binding before applying voted authority. Changed content needs renewed authority. Actual funder submission is a separately controlled step.

Ordinary authorized research, drafts and website maintenance need no vote. The required final packet vote is independent of an optional shortlist vote. Factual application assertions require claim-specific support and appropriate attribution. Proposed work remains explicitly proposed; accepted facts and commitments retain their approval requirements. The DAO website is the intended authoritative organizational knowledge source, including governance rules and formation documents. The deployed agent retrieves these through authorized authenticated access before asking the user to re-enter facts. Preserve source URL/document ID, version or content hash, retrieval time, exact supporting passage and access classification with each claim. Establish source gaps through authorized retrieval. Keep restricted material out of public artifacts and outside contributors’ authorized data scope.

### Funding quality and meeting preparation: R-F01–R-F08

The [detailed funding specification](docs/development/funding-enhancement/spec.md) records delivered contracts and remaining integrations. A case owner coordinates research, eligibility, evidence, drafting, independent review and submission preparation. Specialists run when needed. Start with one draft and up to two targeted rework rounds, with configurable limits.

- R-F01: Draft all answerable requirements before requesting human input. Keep draft candidates separate from accepted facts, with exact requirement/version, claim spans, evidence hashes, route and remaining gaps. Preserve all sponsor requirements in readiness reporting.
- R-F02: Independently assess claim support, route, numeric evidence and contradictions against the frozen candidate. Draft DAO contributions on partner routes while retaining lead-owned requirements. Distinguish observed evidence, attributed statements, proposed work and authorized commitments.
- R-F03: Query saved partners and evidence before external research; investigate only missing or stale facts. Persist attempts, evidence needs, options, permitted contacts and prepared work. Return the answer plus a reusable knowledge delta, including useful findings from rejected opportunities, under R-K01–08.
- R-F04: Reuse scoped DAO knowledge from admitted sources and meeting minutes. Store revisions, source passages, effective dates, audience, status and supersession. Extraction creates candidates; trusted admission establishes current facts or adopted decisions. Corrections invalidate dependent drafts.
- R-F05: Normalize sanitized financial snapshots carrying period, accounting basis, currency and source hash. Task 6 implements a documented USD Profit & Loss fixture; actual QuickBooks compatibility requires provider qualification. Qualify the selected export/API separately and keep actuals, requested funding, available cash and approved spending distinct.
- R-F06: Prepare a DAO meeting brief covering opportunity/deadline, direct or partner route, fit, active projects, application effort, delivery effort, reporting obligations, drafted sections and remaining decisions with owners. Meeting decisions create scoped knowledge and targeted follow-up work.
- R-F07: Deliver the same canonical skill and proposal contracts through Codex, Claude and a named local tool-using runtime. Qualify actual skill/tool execution. Members receive scoped evidence and proposal tools; trusted servers apply human decisions.

- R-F08: A human handoff includes prepared work and the exact remaining authority, access or private-record decision. A trusted reviewer independently assesses the source-bound gap plan. Rejected plans return concrete agent work; missing review capability keeps work agent-owned. Markdown and DOCX retain current preparation. Reassess the five examples against benchmark v3 preparation and handoff criteria.

### Maintained partner knowledge: R-K01–R-K08 (core, merged)

Current delivery: the core is merged. The approved [operational discovery loop](docs/development/funding-enhancement/discovery-loop.md) connects query-first knowledge, bounded new-source research, official validation, useful writeback, briefs and urgent alerts. The merged default-disabled foundation supports saved-context/URL submission, durable budgets/frontier, known-source preliminary briefs and date urgency before packets, corroborated new-sponsor identity admission and existing Buzz transport. Source-bound new-sponsor deadline/benefit assessment is merged in PR36/DFW PR52 and needs no site-specific adapter. It preserves conditional facts and unknowns; eligibility remains separately established. Activation requires actual research/model qualification, active responsible-member wake mapping and verified human delivery before recurrence.

Task 6 provides the merged evidence/SQL foundation. The Helix projection, retrieval and research-writeback core is merged and independently reviewed; real PostgreSQL-to-embedded-Helix rehearsal passed. Production adapters, admitted inventory/backfill and live qualification remain pending. Reuse existing member, project and evidence identities. Paperclip owns work and decisions; the graph supplies indexed knowledge.

- R-K01: Inventory and index every relevant partner organization, work contact and role, program/project/event, contribution history and DAO relationship owner in authorized existing records, website sources and meeting material. Each inventoried item has a stable identity or explicit unresolved disposition, with source revision and coverage receipt.
- R-K02: Preserve source ID/revision/hash, exact locator, observation time, effective interval when known, audience, project/opportunity scope and trusted admission history. Keep prospect/collaborator, candidate/current/disputed, and planned/started/completed/cancelled/unknown delivery stages separate. Dates alone never establish completed delivery or a relationship.
- R-K03: Query saved evidence before new research; reuse fresh facts and research only uncovered needs. Every scan/diligence completion returns an answer plus a durable useful knowledge delta or an explained no-change receipt. A no-change receipt completes the task without a graph write. Rejected opportunities can still add reusable organization, program, capability or contact evidence.
- R-K04: Commit admitted evidence, typed assertions/history and projection outbox rows in one DAO PostgreSQL transaction. Scope retry identity by tenant/run/delta key and payload hash; replay the same receipt, reject changed payloads and preserve separate corroborating sources. Uncertain assertions remain candidates.
- R-K05: Project admitted facts into indexed Helix nodes/edges idempotently. Qualify atomic target-side fencing/revision checks, lost-response reconciliation, tombstones, resumable backfill and generation rebuild before release. PostgreSQL remains authoritative throughout projection recovery.
- R-K06: Provide bounded tools for partner-by-capability search, partner/contact/work context, evidenced introduction paths and research-delta commit. Derive authority server-side; filter every traversal hop and revalidate current PostgreSQL/source access, revision and freshness before showing names, contacts, quotes or citations. A stale or revoked projection cannot leak data.
- R-K07: On Helix outage or lag, use bounded indexed PostgreSQL retrieval with degraded coverage. If authoritative access/source state cannot be checked, withhold affected results. Report pending projection state without losing the durable delta or repeating all partner research.
- R-K08: Prove known-partner reuse → useful research → durable delta → next-run retrieval, including rejected opportunities, identity corrections, scope revocation and crash/replay. Target top-20 queries including revalidation at p95 <1 second and admitted updates at p95 <60 seconds on a documented representative fixture; these are unmeasured acceptance targets.

Seed DAO, TechFW/MADE, Moonshot, LiquidAcre and HackFW, then cover the complete bounded source inventory. MADE is a TechFW program. Moonshot and LiquidAcre are existing collaborators; individual roles and work retain their own evidence and stage. October 30 closing-host work remains planned until delivery evidence exists. Preserve the spoken “Liquid Acres” mention separately until its candidate mapping is admitted. Exact IRS records verify DAO EIN 41-2815082 and public-charity status; the determination-letter attachment, filing address versus service geography, and opportunity-specific eligibility are separate facts. [Source evidence and status](docs/development/funding-enhancement/source-map.md).

### General objective intake: R-I01–R-I04 (core merged)

Objective intake, versioned funding links and brief rendering are merged. The actual-service synthetic meeting-answer → scoped knowledge → follow-up → revised-brief rehearsal passed independent review. Production source/member exports, native visibility and assigned live intake remain activation requirements.

- R-I01: Every website innovation-bounty submission enters the general Paperclip backlog. Preserve original text, submitter, visibility and source identity. The CEO prioritizes within its assigned mandate.
- R-I02: One durable source-to-native mapping reconciles retries and unknown creates. Trusted ordering and compare-and-swap prevent stale updates. Withdrawal retains an audit record; audience narrowing suppresses derived output until permissions converge.
- R-I03: DFW stores versioned many-to-many objective/funding links with fit rationale, contribution and packet reference. Website owns submitted content, Paperclip owns work state, and DFW owns funding/link state.
- R-I04: Buzz, dashboard and member portal expose permitted views of those records. General objectives can proceed without grant work. Funding may support existing objectives or reveal new project opportunities.

### Member contribution: R-C01–R-C05

The user will arrange repository-admin access for a second rehearsal participant. Authorize that participant’s agent separately within the DAO application. DAO privileges and control-plane access require their own explicit grants.

The [candidate-only boundary](docs/development/member-contribution-boundary.md) is merged in PR37 and independently qualified. It admits scoped inputs and validated inert artifacts to immutable replay-safe receipts. Engineering must provide authenticated ingress and a non-reusable authority epoch for each execution attempt. Live enrollment/provider execution, native review handoff, authoritative completion and R-C05 follow-up remain next.

- R-C01: Pair a member and agent, verify membership and capabilities, and limit access to approved companies/projects/tasks.
- R-C02: Use native eager acquisition, checkout and dependency handling. Configure explicit autonomy, hiring and budget permissions.
- R-C03: Execute client-side using a qualified sandbox and isolated workspace, with narrowly scoped data and tools. The server validates artifact types, size, provenance and authorized state transition.
- R-C04: Recover interrupted work through native runner/plugin lifecycle and reconcile stale or duplicate results. Accept one authoritative completion per task revision.
- R-C05: Allow follow-up creation with parent context, reason, acceptance criteria and deduplication. Apply budget/depth/rate limits and retain human visibility in both UIs.

### Operations and Y2

- R-O01: Native operational state links source events, issues, runs, artifacts, decisions and external receipts. Configure retry limits, cancellation, budget admission and audit retention.
- R-Y01: Register a relevant grant/program/partner interest with Y2; map each relevant update to the existing issue or a deduplicated follow-up, retaining the originating interest and source reference.
- R-X01 (later): Enrich grant research with broader 990 Graph data and optional vector/semantic retrieval after the operational partner graph. Preserve filing provenance and review relevance; similarity never establishes a relationship or eligibility.

## 5. Data and authority

Default to **one relational database on the existing DAO managed PostgreSQL service** for grant funding and meeting information, with domain-owned schemas/tables and least-privilege service roles. Preserve the funding data model and DAO website/Drizzle ownership. Explicit service roles govern cross-domain reads and writes. Deployment determines physical server placement while domains retain logical ownership.

Paperclip keeps its **independent native database**, including plugin transport state. Buzz retains existing transport storage. Funding services own evidence, validated proposals, immutable packets and domain review audit in the DAO database; meeting services own publication versions and audience enforcement there. Native authenticated decisions remain in Paperclip and reconcile through the tested, default-disabled adapter. Durable native acceptance and DFW reconciliation are implemented and independently reviewed; production source/transport, retention/archive and writer-fence qualification remain pending. Reconcile changes through durable receipts across the separate stores.

Helix is the **core derived indexed partner graph**. DAO PostgreSQL owns evidence, typed facts, history and the transactional projection outbox; Paperclip owns native work and decisions in its separate database. Helix is rebuildable and every returned fact is revalidated against current source/access state. Priority removals and read-time denial make revocations effective even during projection outages. Broader 990 and vector enrichment come later. Partner capability and relationship evidence support opportunity-specific diligence; packet-bound review and governance retain authority.

The [data consolidation contract](docs/development/dao-data-consolidation.md) defines source compatibility, schema ownership and the gated migration/rollback plan. Use native connection/credential facilities and scoped bindings. Database migration, credential changes and deployment remain separate authorized tasks.

A blockchain vote and a Paperclip workflow approval are separate evidence types. A native approval can coordinate work; voted DAO authority additionally requires the immutable packet and chain result. A changed packet invalidates reuse of the earlier vote. Uploading private documents to public or content-addressed storage requires explicit sharing authorization.

## 6. Acceptance

The demo evidence package contains: source-to-publication trace and readback; current grant sources, reviewed packet and bound vote receipt; a second member's successful contribution and denied unauthorized action; identical task/decision state in Buzz and dashboard; and recovery evidence for duplicate ingress and reconnect. It also includes indexed partner reuse, durable research writeback and next-run retrieval, complete bounded partner/contact coverage and recovery/revocation proof under R-K01–08. See testing.md for precise fixtures and expected outcomes.

## 7. Design progression

The bridge is merged. Complete live admission and domain adapters against the contracts below, reusing native scheduling and the existing hardened execution integration.

## 8. Bridge implementation

### Experience

One-time pairing and channel binding are administrator setup. Thereafter members reply in their existing Buzz thread or use the Paperclip dashboard, without moving task IDs between tools. A decision card gives context and a clear accept/reject action; the result appears in the same thread. Normal successful processing is quiet. A recoverable disconnect heals automatically; an unresolved action shows one concise status with a retry or configuration instruction. Operator health reports connection, backlog and oldest pending item, last successful sync, and the precise next action when blocked. Use the existing native dashboard.

The initial executable delivers signed Buzz ingress → native human comment or accept/reject decision → signed Buzz receipt, plus native interaction → Buzz decision prompt. It runs end to end with realistic fixture services. Production connection settings and pairing records are injected by the trusted host. Live key creation, grants, provisioning and deployment are separate operational steps.

### Regular Paperclip upgrades

Target the latest Paperclip release that passes qualification. Version pins identify reproducible evaluation and release artifacts. Maintain a small version manifest with host/SDK versions, source/package integrity, plugin version and schema state. For each candidate, run compatibility tests, clean package installation, native-service checks and full-host smoke tests in a disposable environment. Review changed capabilities and migrations, exercise the existing database upgrade path, then promote the tested artifact through the normal deployment process.

Keep the previous artifact and a verified pre-upgrade database backup. Rehearse recovery by restoring the compatible backup and previous runtime together; binary downgrade alone cannot reverse database migrations. Record the upgrade result and one useful operator action if qualification fails. The implemented checker and isolated qualification commands are described in [Paperclip upgrades](docs/qualification/paperclip-upgrades.md): `node scripts/paperclip-upgrade.mjs` refreshes release metadata, and `node scripts/paperclip-upgrade.mjs --qualify` runs the disposable SDK/package qualification. Native/full-host candidate checks and tested database recovery remain promotion gates. Live auto-upgrades: disabled.

### Baseline and implementation

Use TypeScript ESM on Node 24.11+, npm lockfile, Vitest, and nostr-tools for Nostr cryptography. Compile the plugin manifest and native adapter against the public Paperclip SDK from v2026.1012.0, commit bba6a45f0d364cfd962ac59b3bdf2426a8222adb. Use the public registry package @paperclipai/plugin-sdk@2026.1012.0 and record its integrity; its release version differs from the source package.json version 1.0.0. Compile against the published artifact and audit its compatibility with the source pin. Upgrade the host/SDK together through the qualification process; keep each tested build reproducible and avoid copying private vendor trees. Keep the source pin and package integrity together in docs/bridge-state-contract.md. Buzz wire baseline is dc25198d530acc6237a0320b697365f29daf0ea6.

Reuse ctx.issues.createComment, listComments, listInteractions and respondInteraction. The host checks current human company membership. A human-attributed comment already participates in native assignee wakes; the bridge adds no extra wake. Initial direct decisions support accept/reject for immutable plain confirmations. Target-bound or structured decisions open their native Paperclip UI. Structured questions, hiring and blockchain ratification require their own typed adapters. The plugin exports a real SDK manifest and worker entrypoint with capability declarations and native health reporting.

### Wire and identity

- Accept only structurally valid Nostr messages whose ID and Schnorr signature verify against canonical event bytes. No inbound flag such as verified=true is trusted.
- Derive the author from the signed public key. Resolve a trusted pairing scoped to the configured relay and company. Incoming actorUserId/companyId fields cannot select authority.
- Derive channel and thread from unambiguous signed tags. Unknown, conflicting, unbound or foreign destinations fail closed. Event kind 9 is the initial supported conversational input. Reject auxiliary/moderation kinds as commands.
- Pairing distinguishes human and agent. Unknown/revoked identities cannot write; agents cannot use the human decision path, even with owner attestation.
- Bind relay+channel+root to a native issue and company in host-controlled configuration. A signed command cannot redirect that binding.
- Use POST /query for reads and POST /events for publishing. Authenticate with fresh NIP-98 events, kind 27235, binding exact URL, HTTP method and SHA-256 request body. Disable redirects. Permit only the configured HTTPS relay origin (loopback HTTP only in test mode).
- Outbound event signing is injected through a signer; persist the signed event before delivery. Retry the same event ID, with fresh HTTP authentication. Incoming bridge-authored events and known outbox IDs never trigger native work.
- Render an interaction's native ID plus a random opaque card token. Store the token's company, issue, interaction and rendered-content digest. A reply must match that binding and current interaction content. New/replaced content produces a new card. Parse explicit accept/reject commands deterministically; ambiguous replies require clarification.

Initial text fallback: normal replies in a bound issue thread become comments; decision prompts include `/inertia accept <card-token>` and `/inertia reject <card-token>`. Malformed or unknown `/inertia` commands return short guidance and remain outside the comment path. Existing Buzz buttons can later map to the same verified command without changing authorization.

### Persistence and reconciliation

Use the plugin's namespaced PostgreSQL database via ctx.db, with migrations for bridge bindings, pairings, inbox receipts, decision-card bindings, and outbox records. These records track transport; native Paperclip owns the work queue. SQL parameters carry all values; namespace is the host-provided validated identifier. Use unique keys and atomic compare-and-set transitions for deduplication. A lightweight PostgreSQL-compatible fixture database may execute the same migration/queries in tests; report its scope accurately.

Inbox key is (relay, eventId). States are received, applying, applied, rejected, and uncertain. Claim with a conditional write before host mutation. Applied/rejected duplicates return the saved result. Persist the destination and deterministic receipt key with the result; an outbox repair pass reconstructs a missing receipt from an applied row after a crash. Only one claimant enters applying. Reconcile an expired claim’s mutation outcome before retrying.

Native comments have no assumed idempotency key: include a stable source-event correlation marker in the comment and reconcile listComments after a lost response. If a matching comment exists, save its native ID; if the previous request may still complete, retain uncertain and do not issue a second create. Native interactions return applied=false when already resolved; render the authoritative result, never claim the requested opposite action won. Before resolving, reread the interaction and enforce card binding. Use the host's atomic resolution as final authority. If the chosen host allows pending interaction content mutation without compare-and-set, disable direct resolution for that case and link to the native card until a safe API exists.

Delivery states include pending, publishing, delivered, blocked and suppressed. Native comments use non-expiring publication claims; see [comment recovery](docs/native-comment-mirroring.md#concurrency-and-interrupted-publication). A lost publish response retries the same signed event; relay event-ID deduplication converges. Use bounded exponential backoff with jitter for transport failures and 429/5xx, respect Retry-After, and surface permanent 4xx/configuration failures once. Native plugin jobs/events own reconciliation scheduling. Cursors advance only after each fetched event has a durable disposition. Recheck a bounded recent lookback for delayed events, deduplicate by event ID, and persist resumable historical backfill. Isolate future-dated events so they cannot move the checkpoint beyond legitimate traffic. Scope health and recovery to the configured company; addressed confirmation cards stay with their authorized audience. Source edits/deletes become linked correction/tombstone evidence; they never retroactively reverse an accepted native decision.

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


## Team integration handoffs

Track concrete owner inputs, minimal handoffs and qualification status in [Needed from team](Needed-from-team.md). Stable NTF IDs map to the existing setup, requirement and test contracts. Update affected entries alongside these artifacts; receipt of an input does not establish live qualification.
