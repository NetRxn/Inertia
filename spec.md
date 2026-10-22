# Inertia specification

Revision: INERTIA-2026-10-22-r4  
Updated: 2026-10-22 (UTC)  
Status: Planning baseline. No implementation, deployment, scan, or application test execution is represented as complete.

## Synchronized artifact set

- [spec.md](spec.md): requirements, boundaries, contracts, and sources.
- [testing.md](testing.md): acceptance and security tests defined before implementation.
- [decisions.md](decisions.md): confirmed decisions, proposals, and unresolved choices.
- [plan.md](plan.md): proposed sequence, dependencies, and evidence gates.
- [Inertia-Architecture.pptx](Inertia-Architecture.pptx): editable seven-slide architecture view.

All five artifacts carry the same revision. Future user updates must reconcile all five, including explicit no-change checks. Preserve stable filenames and IDs, record superseded choices, and do not silently convert proposals into confirmed decisions. No newly generated PDF is part of this active set. The original [product overview](docs/reference/Inertia-beta-product-overview.pdf) is preserved unchanged as historical source material; its older sequencing does not override these current artifacts.

## Change summary

- Confirmed public project home: [NetRxn/Inertia](https://github.com/NetRxn/Inertia). Owner authorized publication of these artifacts and the original overview. Use focused branches, reviewable commits and pull requests; implementation and deployment remain separate.

- Confirmed Google Meet recording and Gemini processing, with outputs in the organization’s Google Drive folder. Folder IDs, exact output types, readiness signals, access, and retention remain TBD.
- Confirmed PlanetScale PostgreSQL for the DAO website. Preserve existing storage and de-prioritize Helix.
- Added the required member-agent contribution objective with client-side sandboxed execution, worktrees, and server-mediated result acceptance.
- Retained the grant packet submission vote and Y2 watch loop. Integration with the existing 990 workbench is a stretch TODO.
- Added a requirement-to-test map, security gates, decision statuses, and a proposed one-week implementation sequence.

## 1. Purpose and status language

Inertia is the Fort Worth DAO HackFW general-lane project, not a prize-specific entry. The proposed target is a credible demo by October 29, 2026, ahead of the confirmed October 30 deadline. October 29 and the implementation dates below are proposed planning targets, not completed work or commitments assigned to individuals.

- **Confirmed** means a user decision or verified existing capability. A confirmed requirement does not imply implemented support.
- **Proposed** means an engineering recommendation or integration design awaiting selection.
- **TBD** means unresolved access, contract, owner, or implementation detail.
- **Stretch** means excluded from baseline acceptance and pursued only after the required flows work.

The three required objectives are automatic meeting publication, grant preparation with a packet-specific blockchain submission vote, and secure contribution of members’ own agent capacity to pending work. Routine authorized work does not require a vote. Security enforcement does not introduce a vote for every action.

Project repository: [NetRxn/Inertia](https://github.com/NetRxn/Inertia), public, default branch `main`. This is the Inertia integration/planning home, separate from the existing DAO platform and grant-engine repositories. Publication permission does not authorize deployment or live external actions.

## 2. Existing systems and planned roles

| Component | Evidence and role | Boundary |
|---|---|---|
| Google Meet, Gemini, org Google Drive | Confirmed by user: meeting video recording, Gemini processing, output storage in the org’s Drive folder. | Exact folder identifiers, event/readiness contract, transcript availability, permissions, publication scope, retention TBD. |
| DAO platform | User confirms PlanetScale PostgreSQL. Public dao-platform repository supports PostgreSQL/Drizzle, Privy, and Pinata/IPFS documents. | Preserve existing database and document choices. Pinata/IPFS availability does not authorize public storage of restricted material. Exact deployed publication API and access enforcement require validation. |
| Buzz | Existing member chat and website-building agent. Deployment access and adapter contract remain TBD. | Conversation surface, not the authoritative work ledger. Local OpenAI-compatible inference is plausible, not confirmed. |
| Agent management | Paperclip-style management is a candidate for queue, roles, runs, and visibility. | It may also provide execution orchestration. Do not mandate a second scheduler before capability checks. |
| Trusted control plane | Proposed job authorization, durable ledger, claim/lease handling, validation, and publication. | Owns production credentials. Product, deployment, and ledger storage owner TBD. |
| Member runtime | Required members’ own client-side agents and model/runtime capacity. | Untrusted to the server. Worktree isolation is organizational only. Container, VM, or OS isolation must enforce the chosen threat model. |
| DFW-Gov-Fund 3.4.0 | Existing CLI, stdio MCP, FastAPI, Python rules, weighted matching, template-first drafts, cited model proposals, immutable packets, role signoffs, and manual portal receipts. | Grant database uses SQLite or configurable PostgreSQL, with filesystem packets. No evidence it shares the DAO database. No embedded full LLM/OpenAI configuration or blockchain bridge established. Root README version 3.0.2 is stale. |
| Y2 | Teammate-owned planned watch component. Register initiative, grant, program, or partner interests and return source-backed updates. | Actual account access and API/MCP/webhook contract TBD. Closed work retires its watch. |
| Cloudflare | Available as a possible infrastructure provider. | Services, plan, deployment, and suitability unverified. Optional hosting/edge/queue/object-storage candidates, not selected architecture. |
| Helix / external labs | Helix is de-prioritized. Optional future graph/vector projection. 990 grant search is stretch. TexasNova is context. | Public lab endpoints were not independently inspected. Do not assume their APIs, graph backend, or integrations. |

## 3. Requirements and acceptance anchors

All requirements below are baseline unless explicitly labeled stretch. Implementation details identified as proposed require the corresponding decision in decisions.md.

| ID | Requirement | Acceptance / test IDs |
|---|---|---|
| R-M01 | Automatically ingest ready, authorized meeting source material from the confirmed Meet/Gemini/org Drive path, without per-meeting human approval. | T-M01, T-M05 |
| R-M02 | Preserve immutable original material and distinguish source type. Produce a faithful cleaned transcript and separate notes when transcript-capable input exists. Never reconstruct a transcript from a summary. Preserve uncertain speakers, statements, owners, and decisions as uncertain. | T-M01, T-M04, T-I01 |
| R-M03 | Use stable meeting ID, content hash, output version, and source lineage. Repeated source delivery must not create duplicate publication. Corrections create a traceable new version. | T-M02, T-M03 |
| R-M04 | Upload/upsert both outputs automatically within the configured authorized audience, read back content and access metadata, then record completion. Retry recoverable failures and queue unresolved exceptions. | T-M01, T-M03, T-M05, T-S02 |
| R-G01 | Use the existing grant engine to form a current, source-backed shortlist with freshness and direct/partner eligibility explicitly stated. Missing organization facts remain unknown until verified. | T-G01 |
| R-G02 | Produce draft packets and preserve citations. Human review creates an accepted immutable packet. Applicable role signoffs bind that exact version before submission-readiness. Model suggestions do not become facts or approvals. | T-G02, T-I01 |
| R-G03 | Bind a blockchain vote on WHETHER to submit to an immutable packet ID, version, and hash. A changed packet does not inherit approval. The vote does not override eligibility, signoffs, or submission rules. | T-G03, T-G04 |
| R-G04 | Keep actual funder submission separate from demo acceptance. Do not imply official submission status without a separately authorized submission and receipt. A top-three selection vote is optional, not required. | T-G04 |
| R-C01 | Allow an authenticated member to connect their own agent, discover authorized pending work, opt into bounded assignments, and return a contribution using their own client runtime/model. | T-C01, T-S01 |
| R-C02 | Isolate each job’s workspace and execution with an enforceable sandbox. Worktrees alone do not protect data, the host, or other jobs. Prevent access to production credentials and unauthorized data. | T-S02, T-S04, T-S05 |
| R-C03 | The server, not the client, controls job authorization, task scope, authoritative claim/lease state, result validation, and publication. Treat client output, commands, metadata, and claimed identities as untrusted. | T-S01, T-S03, T-S06 |
| R-C04 | Use atomic claims, expiry/revocation checks, fencing epochs, idempotent receipts, and uniqueness enforcement for at-most-once result acceptance. Reconcile external side effects after ambiguous failures. | T-C02, T-C03, T-C04 |
| R-C05 | Enforce member/tenant scope across listing, claim, bundle download, result upload, status, and publication. Reject expired or revoked capabilities. Record provenance and audit events without leaking secrets. | T-S01, T-S02, T-S03, T-C03 |
| R-O01 | Maintain a durable work ledger of tasks, claims, runs, attempts, retries, exceptions, receipts, and result references, separate from chat logs. Surface actionable exception state. | T-C02, T-C04, T-O01 |
| R-Y01 | Keep Y2 in the planned flow: registered interests produce source-backed alerts into discovery or active work, with deduplication, related IDs, observation time, and retirement on closure. | T-Y01 |
| R-D01 | Preserve the DAO PlanetScale PostgreSQL/Drizzle system and separate grant storage. Share narrow adapters and stable IDs, not a new mandatory shared database. | T-O02 |
| R-A01 | Keep the four Markdown documents and editable architecture deck synchronized on every user-provided update. Use the same revision/date, stable IDs, sources, statuses, and demo boundaries. | T-A01 |
| R-X01 | Stretch only: evaluate integration with the existing 990 search/workbench after core acceptance. No new Helix build is a prerequisite. | T-X01 |

## 4. Meeting flow and source contract

Proposed flow: Drive readiness event or poll discovers a completed source, then a reconciliation pass catches missed events. The trusted worker captures an immutable original reference and hash, derives the cleaned transcript and separate notes, validates scope and source fidelity, publishes/upserts, reads both artifacts back, and commits completion evidence. Routine successful jobs have no manual approval gate. Failures with unknown authorization, incomplete source, or unsafe output stop in an exception queue rather than broadening access.

Proposed source fields: meeting_id, source_uri, source_kind, source_hash, source_revision, occurred_at, observed_at, readiness_state, access_scope, retention_policy_ref. Proposed output fields: artifact_kind, artifact_version, output_hash, source_reference, processing_version, publication_id, publication_uri, readback_hash, verified_scope, completed_at.

The September 9 and May 6 examples are meeting notes, not verbatim transcripts. They can seed notes-only test fixtures, but cannot prove transcript cleanup. A summary-only input must explicitly report that transcript input is missing rather than fabricate it. Derived meeting claims are not independently verified legal, tax, or financial facts.

The configured authorized audience may be member-only or public as explicitly approved. Preserve that policy without silently expanding or narrowing access.

Proposed agent authentication reuses established member login. An authenticated pairing action issues a short-lived single-use code, then a narrowly scoped revocable credential bound to organization/member/agent/expiry. Store token hashes, not tokens, and never log credentials. Validate current membership and operation authority on list, claim, download, heartbeat and submit. Use TLS, rate limits and CSRF protection for cookie-authenticated mutations. Prefer authenticated downloads over transferable bearer URLs. Exact auth implementation remains TBD.

The Drive folder is known conceptually. Only its identifiers and delivery/access contract remain unresolved. Confirm whether Gemini produces notes, transcript, recording references, or multiple outputs before choosing the adapter. Do not assume private IPFS support: choose a publication/storage route that actually preserves the authorized scope.

## 5. Grant and governance flow

Use the installed grant engine’s existing evidence and packet mechanisms through a narrow adapter. Refresh the relevant candidate against current sources, distinguish a direct DAO applicant route from a partner route, prepare a template-first packet, and surface missing facts for the relevant human. External models may offer bounded cited proposals. Human acceptance creates a new immutable reviewed packet. Applicable role signoffs bind that exact version before submission-readiness, with governance sequencing determined by the selected policy.

Proposed vote envelope: opportunity_id, packet_id, packet_version, packet_hash, evidence_refs, applicant_route, required_signoffs, vote_id, vote_scope, chain_reference, outcome, finality_status, observed_at. The exact blockchain/Vocdoni adapter remains TBD. A recorded vote applies only to its actual scope and version. Retries must not create duplicate votes. Do not claim a final decision while chain state is unresolved or before the selected finality policy is met.

Historical saved grant results exist. Revalidate source freshness and applicant evidence before use; historical assessments do not establish current openings or eligibility. No new scan or application test was launched for this artifact revision.

Y2 remains a planned feedback loop: register an approved interest, receive an alert with source URL and observation time, correlate it to an initiative/opportunity/application, recheck relevant evidence, and retire the watch when work closes. An alert is evidence to evaluate, not a DAO decision.

## 6. Secure member contribution contract

### Proposed minimum demo security baseline

Voluntary, untrusted member clients receive only public or synthetic task bundles explicitly approved for that distribution. This is a proposed safeguard, not a user-imposed exclusion of future confidential work. Restricted meeting processing stays on a trusted runtime unless a separately approved trust and data-handling policy establishes an appropriate route. A sandbox on a member-owned device cannot prevent the owner from retaining downloaded content or guarantee deletion. Client choice of a hosted model is also potential third-party disclosure, so bundle policy must cover model/provider egress.

The demo should use one narrow task type, such as reviewing a public grant source for a cited structured finding, with two clients to prove claim contention and a malicious/revoked-client test. Model inference can occur within the member’s chosen runtime subject to permitted data/egress rules. Model availability does not grant authority to execute commands or publish results.

### Proposed protocol

1. Authenticate the member and register an agent identity plus declared capabilities. Server policy determines allowed task types and scopes.
2. List only jobs authorized for the member. Claim one atomically, issuing a bounded lease with task ID, attempt ID, epoch, expiry, allowed input references, allowed output type, and resource/egress limits.
3. Download only the scoped bundle after fresh authorization checks. Use short-lived, narrowly scoped access. No production database, Drive, publishing, chain signing, or other production secrets enter the bundle.
4. Execute in a fresh restricted workspace inside the selected sandbox. Use a worktree where source editing benefits from it, without treating Git as the sandbox. Deny privileged host mounts, Docker socket access, ambient credentials, and arbitrary outbound network access. Enforce CPU, memory, time, disk, and output-size limits.
5. Return a manifest with input hashes, output hashes, source citations, task/run/attempt IDs, lease epoch, and claimed tool/model provenance. Client assertions are audit hints, never proof of trustworthiness.
6. Server rechecks identity, scope, lease epoch, expiry, revocation, input lineage, output schema, size, paths, content, and policy. Quarantine malformed or unsafe results. Never execute returned code or follow returned URLs without independent validation. Validate citations and semantics for the task.
7. Accept at most one eligible result using database uniqueness and a transaction/outbox or equivalent durable mechanism. A trusted publisher performs authorized side effects and verifies readback. Retries use idempotency keys and reconcile uncertain outcomes before replay.
8. Revoke or expire access, clear the managed workspace where feasible, record the outcome, and release/reassign work under a new epoch. Do not promise deletion from member-controlled storage.

Proposed server records: task(id, type, scope, input_version/hash, state), claim(task_id, attempt_id, member_id, agent_id, lease_epoch, expires_at, revoked_at), run(attempt_id, heartbeat, limits, status), result(receipt_id, manifest_hash, accepted_version, validation_status), publication(idempotency_key, destination, payload_hash, status, readback_ref), audit(actor, action, target, outcome, timestamp). Exact schema and storage owner remain TBD.

Proposed state model: pending → leased → result_received → validating → accepted → publishing → completed. A rejected or expired attempt cannot publish. Recovery may requeue the task with a new epoch. Exceptions are explicit terminal or operator-action states. Leases fence server acceptance and publishing, but do not remotely stop an offline client from computing.

## 7. Scope exclusions and deferred work

- No authorization in this revision to build, deploy, create accounts/services, start monitors, run scans, cast votes, or submit grants.
- No required DAO/engine database migration or shared database assumption.
- No mandatory second orchestrator, hosted model provider, Cloudflare service, or new Helix database.
- No new TexasNova workstream. No claim that other DAO repositories implement the user-provided labs.
- No funder portal submission in baseline demo acceptance.
- No automatic trust of member outputs, model instructions, or chat-derived organization facts.

## 8. Sources and evidence limits

1. User architecture directions and corrections, through October 22, 2026. These establish the required objectives, October 30 deadline, Meet/Gemini/Drive path, PlanetScale choice, Helix priority, client execution requirement, and artifact maintenance instruction.
2. Prior Inertia architecture revision v2, October 22, 2026. This revision supersedes its two-objective scope and unresolved source-provider description.
3. DAO public repository: https://github.com/FWTX-DAO/dao-platform and site https://dao.fwtx.city/ . Repository evidence does not prove the exact live deployment configuration.
4. DAO repository index: https://github.com/orgs/FWTX-DAO/repositories . A distinct website/Astro repository exists. Do not silently substitute it for dao-platform.
5. Grant engine: https://github.com/NetRxn/DFW-Gov-Fund and prior read-only local inspection summarized above. Version 3.4.0 capability findings supersede stale root README version text.
6. Y2: https://y2.dev/ . Team ownership is user context. Actual access and integration contract remain unverified.
7. User-described TexasNova: https://texas-nova.labs.fwtx.city/ . Real-time Texas county news context. Endpoint content/API not independently verified in this review.
8. User-described 990 Graph: https://990-g2.ntx.labs.fwtx.city/login . IRS Form 990 knowledge-graph read-only workbench context. Endpoint content/API and backend not independently verified. Integration with the existing service is a stretch TODO.

See decisions.md for unresolved items, testing.md for pre-execution evidence requirements, and plan.md for the dependency-ordered implementation proposal.
