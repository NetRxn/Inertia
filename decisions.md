# Inertia decisions

Revision: INERTIA-2026-10-24-r18
Updated: 2026-10-24 (UTC)
Status: Public drafting/gaps, Task 6, partner graph, cloud qualification/race fixes and objective intake/briefs are merged. Real PostgreSQL, native-service and embedded-Helix cloud rehearsal and the synthetic meeting-answer loop passed independent review. The durable native acceptance core is implemented and independently reviewed, with DFW PR50 and Inertia host PR31 merged; it remains non-live pending production composition and qualification. Meeting source/native composition is merged in PR34 and independently qualified, default-disabled. The discovery foundation and source-bound funding facts are merged in Inertia PR35/36 and DFW PR51/52; live activation remains pending. The member candidate-only boundary is merged in PR37 and independently qualified. Daily recurring scouting remains disabled.


## Current baseline

Develop `30640183` (PR37) includes the cumulative core, cloud qualification/race fixes, Task 8, the default-disabled legacy adapter, non-live durable host bundle, PR33 team checklist, meeting source/native composition, discovery/facts and inactive member candidate boundary. DFW durable acceptance is merged in PR50. See [implementation status](spec.md#implementation-status) and the exact [qualification record](testing.md#qualification-record). Live deployment and domain admission are pending.

## Settled decisions

| ID | Decision | Consequence |
|---|---|---|
| D01 | Three required outcomes: meetings, grant vote, member contribution | Preserve all three through planning. |
| D02 | Meet/video → Gemini → organization Drive | Integrate actual outputs once access contract is known. |
| D03 | Automatic cleaned transcript and notes publication | Routine in-policy publication is automatic. |
| D04 | Preserve source fidelity and audience | Version outputs, retain source and read back publication. |
| D05 | Reuse DAO PlanetScale PostgreSQL for funding and meetings | One relational database; isolated domain schemas and service roles. Paperclip DB remains independent. |
| D06 | Reuse existing grant scanner | Qualify its current interfaces and refresh stale opportunities. |
| D07 | Blockchain voting is settled | Bind final authority to an immutable packet. |
| D08 | Ordinary tasks proceed under their configured authority | Reserve governance review for the decisions that require it. |
| D09 | Y2 remains a demo integration objective | Teammate ownership makes access worth resolving early. |
| D10 | Paperclip is the operational platform | Use its CEO, hiring, hierarchy, tasks and decisions. |
| D11 | Buzz and dashboard are alternative interfaces | Share IDs, permissions and state in both directions. |
| D12 | Agents eagerly acquire work and create follow-ups | Configure native autonomy, budgets and follow-up constraints. |
| D13 | Member agents execute client-side securely | Qualify sandbox, data isolation and server validation. |
| D14 | Reuse native/existing hardening first | Qualify existing execution hardening against the selected Paperclip release. |
| D15 | Maintained Helix partner/people graph and query-first research writeback are core | Require indexed partner reuse and durable knowledge growth in the demo. Broader 990 and optional semantic/vector enrichment follow later. |
| D16 | Cloudflare is available | Select services only when deployment needs justify them. |
| D17 | Keep the specification, tests, decisions, plan, team handoff checklist and architecture artifacts synchronized | Preserve original PDF; use focused Git commits and existing PR. |

## Superseded proposals

Paperclip supplies operations, scheduling, task/approval state, credentials and workspace lifecycle. Add a narrow adapter only for a demonstrated interface gap, with evidence and tests recorded here. Buzz presents native work.

## Selected integration decisions

| ID | Proposal | Decision evidence |
|---|---|---|
| P01 | Build a bounded TypeScript plugin bridge against a qualified public SDK release | Paired-human comments and accept/reject interactions already exist. The initial evaluation baseline is reproducible; regularly qualify latest releases without building a parallel chat engine. |
| P02 | Route Buzz task triggers into one native execution owner | Duplicate-trigger and checkout tests. |
| P03 | Reuse existing execution hardening through native runner/plugin interfaces | Version, license, lifecycle and isolation qualification. |
| P04 | Use native connection profiles and tool policy | Domain credential scopes and call-time authorization tests. |
| P05 | Preserve funding-domain review/signoff semantics through native Paperclip UI | Durable core implemented and merged, non-live; production activation gates pending. |

## Central configuration and compatibility register

Implementation tasks reference these setup IDs.

| ID | Resolve | Evidence needed | Owner / gate |
|---|---|---|---|
| U01 | Public SDK package resolution and eventual serving admission | Reproducible tested baseline: v2026.1012.0 / bba6a45f0d364cfd962ac59b3bdf2426a8222adb. Target latest releases through repeatable qualification; record package integrity and serving admission | Engineering / build and deployment |
| U02 | Existing execution-hardening compatibility and reuse permissions | Version pin, license/authorization, supported lifecycle, isolation and deployment evidence | Engineering qualification / G1 |
| U03 | Buzz instance, runtime route and identity pairing | Supported bridge API, relay endpoints, paired human/agent rules, owner-author configuration | Integration owner / G2 |
| U04 | Drive publication contract | Approved folder/source access, actual examples, stable DAO meeting identity/date, audience and retention; engineering derives and verifies API mappings/readiness | DAO administrator / G2 |
| U05 | DAO publication interface and access | Existing meeting actions authenticate a Privy session; explicit active-DAO-membership enforcement remains required. Target is members-only behind the portal. Current login-only access must gain explicit active-membership checks alongside atomic upsert/readback; prepare the API/schema proposal, user owns rollout | Website owner / integration |
| U06 | Effective multi-stage vote authority | Vocdoni is selected; user will supply an example. Verify whether documented Aragon/final-action stages apply to that actual workflow, then require effective authority and exact packet/action binding. Confirm chain/network from the example | Governance owner / integration |
| U07 | Y2 account and application access | Public API/changefeed route is agreed. Confirm account authorization, registration/update identity, visibility, rate limits and demo data | Y2 teammate / integration |
| U08 | Member participation topology | Named agent versus shared capacity, enrollment/revocation, data classes and capabilities | User + engineering / G2 |
| U09 | Confirm operational budgets before live runs | Default: Paperclip owns scheduling; no duplicate Buzz routine; new hiring requires configured native authority. Conservative bounded retries and task limits in fixture configuration | Engineering / live admission |
| U10 | Hosting and inference | Deploy Paperclip as part of Inertia; connect the existing target Buzz instance. Resolve inference/Cloudflare fit and deployment configuration | Inertia engineering / deployment |
| U11 | Current grant demo candidate | Fresh scan, deadline, eligibility, direct/partner route and approved DAO facts | Grant owner / G3 |
| U12 | Delivery staffing and final date details | Named owners, capacity, proposed October 29 rehearsal buffer and October 30 submission logistics | User / G2 |
| U13 | Native grant reviewer configuration and correction walkthrough | Authenticated humans mapped to required roles; one real packet/correction cycle; member evidence/tool scopes and decision reconciliation | Grant owner + engineering / integration |
| U14 | Shared DAO database readiness | Verify deployed PostgreSQL version, provider schema/role/backup/PostGIS support, current stores, collision inventory and Drizzle/Alembic ownership; qualify restore and cutover | DAO database + domain owners / before migration |
| U15 | Operational partner graph compatibility and inventory | Pin actual Helix API/SDK, qualify atomic fence/revision checks and indexes; inventory source IDs/permissions, existing member/project mappings and relationship owners | Domain + Inertia owners / graph implementation and G3 |

Keep credential references in protected platform configuration.

## Compatibility criteria

Verify API availability and serving-build admission separately. Native hiring requires configured policy. Plugins are trusted code; execution isolation requires separate qualification. On-chain authority requires verified packet-bound evidence.

## Autonomous build defaults

Resolve reversible engineering choices autonomously. Obtain required authorization for live access and consequential external actions.

| ID | Decision and rationale |
|---|---|
| D18 | Node 24.11+, TypeScript ESM, npm/Vitest and real public SDK types. This follows Paperclip's language and keeps a single small package easy to run. |
| D19 | First route is the pinned SDK plugin bridge. Evaluate a latest native-chat provider as a future migration when justified. |
| D20 | Real signed Nostr event verification and NIP98 HTTP transport, injected I/O for tests. No caller-provided trusted flags or simulated cryptographic checks. |
| D21 | Native plugin PostgreSQL stores bridge receipts/bindings; native Paperclip stores work/decision state. Atomic unique writes handle concurrency; native Paperclip owns scheduling. |
| D22 | Source signatures identify keys. Trusted pairing identifies the associated human or agent role. Trusted one-time pairing and apply-time native authorization establish authority. |
| D23 | Comment mutations with lost responses reconcile through a stable source marker. Hold unknown outcomes until reconciliation establishes the result. Interactions use native convergence; edited pending content needs safe replacement/CAS. |
| D24 | Fixture demo is usable with one command. Minimal health reports connection/backlog and a concrete corrective action. No bespoke dashboard. |
| D25 | develop is the integration branch; feature branches and reviewed tested merges are authorized. Preserve main and existing user changes. |
| D31 | Roundtable outputs publish only behind the members-only portal. Explicit active-membership enforcement is required; the website API/schema/contracts are proposed here and the user owns rollout. |
| D32 | Use the existing target Buzz instance and deploy Paperclip as part of Inertia. |
| D33 | Vocdoni is the selected voting route. The user supplies an example; verify applicable final-action/settlement stages before treating a vote as effective authority. |
| D34 | A second rehearsal participant will have repository-admin access. Enroll its agent with scoped DAO permissions separately; repository authority grants no automatic DAO-system privileges. |
| D30 | Aim for latest Paperclip releases. The existing pin identifies the reproducible security/build evaluation baseline; qualify newer releases for promotion. Qualify candidate compatibility, package, migrations and smoke tests; promote with a tested pre-upgrade database restore path and prior runtime. |
| D29 | Cloud-first development and verification. The laptop is a fallback for a specific cloud blocker or required platform check; local Docker checks require a specific authorized fallback. A source-checkout workflow demo supplies a deterministic, explicitly synthetic journey and receipt. |
| D28 | Package version 0.1.0 targets public SDK 2026.1012.0 and Node 24.11.0+. Qualify the actual archive in a fresh production-only install, including a native JSON-RPC worker handshake. Keep development commands in the source checkout. |
| D27 | Keep routine operation automatic after one-time setup. Recover transient faults silently; report only material results, permanent setup failures or unresolved mutation outcomes with a concrete next action. |
| D26 | Private hardening implementation stays outside public artifacts; integrate through public execution contracts. Qualify and deploy the execution layer through its own lifecycle. |
| D35 | Treat the DAO website as the authoritative organizational knowledge source. Retrieve governance and formation evidence using the deployed agent’s authorized access; preserve citations, versions and restrictions. Ask for manual facts only after retrieval reveals a gap. |

Alternatives considered: latest native chat-provider implementation offers broader built-in connector lifecycle but adds version/admission work; a custom standalone task service duplicates Paperclip. The narrow plugin wins on immediate usefulness and reduced maintenance. Transport functions remain separable so a future native provider can reuse verified event handling.

## Integration decisions

- D36: Keep the website caller and website server rollout distinct. The merged caller uses the proposed v1.1 clarification without changing the v1 wire/digest versions. Reject metadata-only corrections until both sides support a metadata-bound versioned codec.
- D37: Use the concrete authenticated cloud deployment checklist. Qualification in isolated local-trusted fixtures never authorizes a publicly exposed or unauthenticated production host.
- D38: Public applicant facts remain attributed review inputs, never eligibility proof. Resolve conflicting governance sources through operative ratification evidence for vote thresholds and signing authority.
- D39: The selected native outbound slice mirrors eligible comments only, default-off with explicit binding audience approval/start time, using the existing durable outbox/reconciler. PR 17 is reviewed/tested and merged into develop. PR 16 supplies the native operator setup checklist; automatic intake still needs an explicitly assigned mandate and authorized live setup. General status mirroring remains future.

- D40: Run grant scouting/drafting through a shared skill/tool harness on central or scoped member Paperclip agents. Native tasks, documents and human-only cards are the default UI; the funding web UI is optional specialist/admin fallback.
- D41: Retain funding evidence, validated proposals, immutable packets and review audit. A tested, default-disabled trusted server adapter applies authenticated, addressed, revision-bound native decisions through domain validation. Current MCP lacks acceptance/signoff; agents cannot approve. Reconcile decision identity (interaction + item for verdicts), proposal/packet ID/version and action, without claiming a cross-system transaction.
- D42: Start corrections with document edit → regenerated proposal → new review. Build a structured panel only after a real walkthrough demonstrates need. Preserve separate Vocdoni authority and exact artifact/packet/review binding.

- D43: Consolidate funding and meeting relational data in one existing DAO PostgreSQL database, with separate domain schemas and least-privilege roles. Keep Paperclip native persistence independent. Choose physical server placement during deployment and qualify provider capabilities before migration.
- D44: Keep Drizzle responsible for DAO website/meeting tables and Alembic for funding tables, with non-overlapping schema scope and separate migration histories. No shared all-powerful application role or competing migration owner. See [consolidation plan](docs/development/dao-data-consolidation.md).
- D45: Helix is the core derived indexed partner graph. DAO PostgreSQL owns admitted evidence, facts/history and an atomic projection outbox; native Paperclip owns work/decisions. Revalidate source/access/version at retrieval and use bounded indexed PG fallback during graph outages. Broader 990 and optional vectors follow later.

## Funding and objective delivery decisions

- D46: Extend DFW-Gov-Fund's existing evidence, proposal and packet services. A case owner plus independent review coordinates six responsibility contracts, with specialist tasks on demand.
- D47: Produce useful machine-reviewed candidates before human signoff. Preserve separate accepted facts and role-bound decisions. Researchable gaps stay with agents; members receive grouped decisions and unavailable private-data requests.
- D48: Reuse Task 6 source-backed organization/project/opportunity knowledge and existing document/audit records. Its evidence/SQL and sanitized USD Profit & Loss fixture contracts are merged and real disposable PostgreSQL qualification passed. Production importer, financial source and role qualification remain pending. Production QuickBooks integration remains separate.
- D49: Every website innovation-bounty submission enters the general Paperclip queue. Keep versioned objective/funding links in the funding domain, separate from project status.
- D50: Use one structured DAO opportunity brief across native documents and permitted portal/Buzz views. Separate application, delivery and reporting effort. Meeting outcomes update knowledge and follow-up work.
- D51: Package a canonical portable skill for Codex, Claude and a named local runtime; qualify tool execution in each. Keep member evidence/proposal access separate from trusted human-review effects.
- D52: Continue authorized implementation in cloud. Inertia feature branches target develop; DFW-Gov-Fund feature branches target main. Preserve review, required checks and repository-specific merge authorization.
- D53: Measure against frozen requirements with independent semantic review and reproducible arithmetic. Keep historical replay separate from current public enrichment. CI candidate qualification precedes runtime qualification; no quality gain is recorded until measured.

- D54: Make gaps actionable and automate permitted preparation. Review existing DAO affiliations and prior programs before building local partner shortlists. Persist source-backed options, public contacts, evidence needs and prepared work in existing audit receipts. Use a trusted reviewer for candidate and gap-plan assessment; unresolved agent work cannot become a human request.
- D55: Require benchmark v3 evidence of preparation sufficiency, action support, decision precision and remaining agent work. Reassess the five examples against v3 preparation and handoff criteria. Distinguish merged implementation, reviewed local work and live model/deployment qualification.

- D56: Query saved partners and evidence before new research. Every scan/diligence result includes a durable useful knowledge delta or explained no-change receipt; preserve reusable findings even when an opportunity is rejected.
- D57: Cover every relevant organization, work contact/role, program/project/event, contribution history and relationship owner in the authorized source inventory. Reuse canonical IDs; unresolved identities remain explicit. Prospect/collaborator, evidence status and delivery stage are independent dimensions.
- D58: Admit a versioned typed assertion envelope bound to exact evidence, identity and scope. Commit evidence/history/outbox together, project idempotently with target-side fencing/version checks and reconcile before acknowledgment. The graph core is merged; real PostgreSQL, native-service and embedded-Helix cloud rehearsal passed. Production source/host/service activation and admitted inventory/backfill remain pending.
- D59: Seed MADE as a TechFW program and Moonshot/LiquidAcre as existing collaborators with attributed activity evidence. Preserve October 30 planned work and candidate aliases separately. Official IRS records verify EIN 41-2815082/public-charity status; the determination-letter attachment and funder-specific eligibility remain separate evidence needs.
- D60: Keep July case improvement, October 23 manual findings, dated replay and actual scanner output separate. October discovery is complete and PR42 is merged with passing post-merge CI. Use the delivered priority diligence queue for actionable preparation while preserving the exact confidence overlay and source limits.

- D61: Extend Tasks 5, 6C/6D and 8 with the approved [operational discovery loop](docs/development/funding-enhancement/discovery-loop.md): query saved evidence, discover uncovered sources, validate official evidence, assess benefit/effort, persist useful knowledge, deliver deduplicated urgent alerts and prioritized briefs, and retain due rechecks in native work. Configure recurring execution after research/model, wake-mapping and human-delivery qualification, rehearsal and cadence agreement.

- D62: Native acceptance captures durable authority for one exact command/version atomically with the verdict. Later native role/document changes, withdrawal or disconnect do not revoke it. DFW-confirmed cancellation is serialized with apply; current funding evidence/head and authorization still gate effects, and submission remains separate. The independently reviewed core is implemented; DFW PR50 and Inertia host PR31 are merged, and production activation gates remain.
- D63: Preserve accepted receipts until terminal DFW acknowledgement or qualified durable transfer, then allow ordinary archival under domain audit retention. Unresolved acceptance needs confirmed cancellation or qualified transfer before removal. Use an approved lifecycle-compatible contract, not an indefinite company-deletion lock or qualification-only retention SQL.

- D64: Use explicit trusted Meet/Drive bindings, verified FILE_GENERATED readiness and unchanged Drive versions for meeting sources. Persist exact publication operations before I/O and reuse native intake for reference-only follow-up. Summary-only sources never become transcripts; notes-only website output remains R-M02 partial. The merged job stays default-disabled pending source/server and installation admission.

- D65: Keep discovery in the existing plugin and native work. Independently corroborated new-source identity does not admit funding facts or a recurring adapter. PR36/DFW PR52 separately assess exact current source spans for conditional deadline/benefit facts without a site-specific adapter. The merged foundation uses preliminary briefs before packets and existing signed Buzz transport; relay acknowledgement does not establish human reading. Active responsible-member mapping, actual research/model quality and delivery admission gate activation.

- D66: Member output is an inert candidate with scoped inputs, validated artifacts and immutable replay-safe receipts. Engineering supplies authenticated ingress and non-reusable per-attempt authority. Native review and authoritative completion require their own current-state fence; candidate staging does not complete work.

## Change log

- r18: Record PR34 meeting source/native composition and its scoped native PostgreSQL/WAL qualification. Record the merged PR35/DFW PR51 discovery foundation and scoped native/cold-DFW/relay-fixture qualification. Record merged PR36/DFW PR52 source-bound funding facts and the merged, independently qualified PR37 member candidate boundary. Keep notes-only website output, live activation and member review/completion pending. Update team handoffs without shifting engineering work to source owners.

- r17: Record merged deadline consistency and DFW durable acceptance, independently qualified atomic native capture and the source-only host publication. Preserve exact-version acceptance/cancellation semantics, scoped test evidence and production activation gates; daily discovery remains disabled.

- r16: Record completed October discovery and merged drafting/gaps, Task 6, graph, cloud qualification/race fixes and Task 8. Record independently passed cloud and synthetic meeting-answer rehearsals. Add the approved operational discovery loop, retaining disabled recurring execution and native-review activation gates.

- r15: Make the maintained partner graph and query-first research writeback core, with bounded coverage, typed evidence, transactional outbox/recovery and pre-implementation tests. Record locally approved Task 6, verified IRS status and the separate October discovery qualification path. Broader 990/vector enrichment stays later.

- r14: Record merged DFW PR35/37/38/39/40, portable skills 3.4.1 and reviewed public drafting/actionable-gap work awaiting publication. Add source-bound prepared-handoff review and benchmark v3. Live runtimes, knowledge/finance, native human decisions and intake remain pending.

- r13: Add funding quality, reusable meeting/financial knowledge, general objective intake, portable runtime contracts and staged implementation/evaluation. CI baseline merged; enhancement results pending.

- r12: Consolidate DAO domain persistence by schema/role, retain separate Paperclip DB, and define a later Helix projection and gated migration. The graph priority in that historical revision is superseded by r15. Design only; runtime/qualification unchanged.
- r11: Adopt native-first grant execution/review, scoped central/member harness and a planned trusted decision adapter. Runtime and qualification evidence unchanged.
- r10: Condense current artifacts, centralize evidence and retain requirements, decisions and acceptance gates.
- r9: Synchronize the reviewed website caller, proposed v1.1 limits, authenticated cloud handoff and public DAO grounding. Record PR 17’s reviewed 248-test candidate and exact native-service receipt while keeping live deployment outside this evidence.
- r8: Add the connected workflow rehearsal, deterministic receipt and native-service evidence; adopt cloud-first execution and latest-release maintenance through repeatable qualification and tested database recovery.
- r7: Record merged grant packet binding, minimum Node 24.11+ and verified package/setup delivery. Preserve the production exporter, chain verifier, native transactional acceptance and website publisher as explicit integration work.
- r6: Select compatibility-backed thin bridge; define signed transport, SDK adapter, durable receipts, recovery tests, autonomous develop workflow and frictionless operator UX.
- r5: Adopt actual Paperclip platform and shared Buzz UI, eager acquisition and follow-up creation; add reuse matrix, bridge contracts, targeted tests, compatibility-first gates and a single external configuration register.
- r4: Establish public repository delivery and synchronized artifacts with unchanged original overview.

## Source baseline

Grant/native-review source pins, 23 October 2026: [Paperclip v2026.1012.0 and DFW-Gov-Fund mapping](docs/reference/native-grant-workflow.md). Earlier general source baselines, 22 October 2026, follow. Exact runtime qualification is recorded in [testing.md](testing.md#qualification-record).

- Paperclip: [341b622604b639b056fc58b10e2dd3312d40385c](https://github.com/paperclipai/paperclip/tree/341b622604b639b056fc58b10e2dd3312d40385c).
- Buzz: [dc25198d530acc6237a0320b697365f29daf0ea6](https://github.com/block/buzz/tree/dc25198d530acc6237a0320b697365f29daf0ea6).
- DAO website: [FWTX-DAO repositories](https://github.com/orgs/FWTX-DAO/repositories); user-confirmed PlanetScale PostgreSQL and Meet/Gemini/organization Drive workflow.
- Existing scanner: [NetRxn/DFW-Gov-Fund](https://github.com/NetRxn/DFW-Gov-Fund), 3.4.0 interface baseline; qualify the selected runnable version.
- [Y2](https://y2.dev/) is teammate-owned and remains an integration objective.
- [Texas Nova](https://texas-nova.labs.fwtx.city/) and [990 Graph](https://990-g2.ntx.labs.fwtx.city/login) are contextual resources; 990 enrichment is stretch.

## Related artifacts

[Specification](spec.md) · [Tests](testing.md) · [Decisions](decisions.md) · [Plan](plan.md) · [Editable architecture](Inertia-Architecture.pptx). Original [product overview](docs/reference/Inertia-beta-product-overview.pdf) retained unchanged.

## Publication gate

Publish the reviewed Markdown, editable deck and visual diagrams together. Preserve qualification receipts, runtime archive and original PDF. Live deployment and credential setup require separate authorization.


## Team integration handoffs

Track concrete owner inputs, minimal handoffs and qualification status in [Needed from team](Needed-from-team.md). Stable NTF IDs map to the existing setup, requirement and test contracts. Update affected entries alongside these artifacts; receipt of an input does not establish live qualification.
