# Inertia specification

Revision: INERTIA-2026-10-22-r5
Updated: 2026-10-22 (UTC)
Stage: Design refinement; compatibility qualification and detailed design review precede implementation.

## 1. Product outcome

Inertia turns DAO conversation and source material into traceable work, lets members contribute spare agent capacity, and returns verified results to the same conversation. Paperclip is the operational platform. Buzz and the Paperclip dashboard are two entry points into the same hierarchy, tasks and decisions.

The required demo has three connected outcomes:
1. A Roundtable recording processed by Gemini reaches organization Drive; Inertia automatically publishes a cleaned transcript and separate notes to the DAO website and returns the resulting links.
2. The existing scanner finds a current grant opportunity; a reviewed application packet is frozen and a blockchain vote is bound to that exact packet.
3. Another DAO member connects an agent, which eagerly acquires eligible work, returns a validated contribution, and creates a justified follow-up when needed.

Y2 watches support the connected loop. Helix is de-prioritized. Form 990 enrichment is a known stretch goal. The demo target is October 29 with an October 30 submission deadline; delivery planning is refined against compatibility results.

## 2. Operating model

### One authoritative work system

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

Preferred route: implement Buzz as a native chat-channel provider if the selected serving build supports those capabilities. Alternative: a bounded plugin bridge using paired-user comments and native interaction APIs. Choose after compatibility qualification; preserve the same IDs and authority in either route. Buzz owner attestations do not turn agent output into a human approval.

## 4. Domain requirements

### Meetings: R-M01–R-M04

- R-M01: Observe authorized ready Meet/Gemini outputs in organization Drive. Identify meeting, source file, source revision and content hash; preserve originals and provenance.
- R-M02: Produce a faithful cleaned transcript separately from notes, decisions and action items. Preserve uncertainties and source links. A summary-only source yields notes and a missing-transcript exception, never an invented transcript.
- R-M03: Automatically upsert both outputs through the existing DAO publication interface under a versioned policy for source folders, document types, destination audience and retention. Routine in-policy meetings need no vote or per-meeting approval.
- R-M04: Read back content, URLs, version and audience. Deduplicate meeting/source versions, reconcile ambiguous writes, and version corrections. An exception becomes a native issue with actionable evidence.

Action-item extraction proposes native work with explicit source references. Unassigned names or ambiguous commitments stay unresolved rather than fabricated. Keep meeting text out of logs where not needed; retrieved text is data, never an instruction to change permissions or execute arbitrary actions.

### Grants: R-G01–R-G04

- R-G01: Reuse the existing scanner's acquisition, eligibility rules, matching, saved-result and drafting interfaces. Refresh opportunity data and record retrieval time, deadline and source URL.
- R-G02: Verify applicant eligibility and direct-versus-partner route. Create a cited, template-based draft, preserving human review and existing signoffs.
- R-G03: Freeze packet ID, version, canonical content hash, attachments and review record. A blockchain vote references exactly this immutable packet and its proposed action.
- R-G04: Validate chain/network, proposal identity, eligible result, finality and packet binding before applying voted authority. Changed content needs renewed authority. Actual funder submission is a separately controlled step.

Ordinary authorized research, drafts and website maintenance operate without a vote. The optional shortlist vote is not a dependency of the required final packet vote. Application assertions must be supported by approved DAO information.

### Member contribution: R-C01–R-C05

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

The settled product/platform choices in decisions.md stand. Qualification determines supported bridge and execution routes. Then review concrete API contracts, selected deployment topology and owners before implementation. This source-informed refinement replaces the earlier generic custom-control-plane proposal.

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
