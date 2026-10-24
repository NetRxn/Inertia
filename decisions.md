# Inertia decisions

Revision: INERTIA-2026-10-24-r24
Updated: 2026-10-24 (UTC)
Status: Wednesday target is PostgreSQL-native knowledge and the existing authorized Buzz agent path. Helix and Y2 are deferred. V2 core and native capture source are merged; Packet UI is reviewed draft PR62, not merged/live. Production bindings and shared recovery agreement remain pending. Legacy v1 records and source behavior remain intact; PR51 stays draft/inactive.


## Current baseline

[PR58](https://github.com/NetRxn/Inertia/pull/58) adds merged trusted native exact-action capture to the [packet-v2 core](https://github.com/NetRxn/Inertia/pull/56). Source/synthetic checks passed; missing trusted authority/retention callbacks keep the path disabled. Owning-domain packet-v2 and named SQL tools retain their recorded local PostgreSQL qualification.

[Draft PR62](https://github.com/NetRxn/Inertia/pull/62) contains reviewed Packet UI/attestation source, not merged or live. Browser walkthrough, mutually agreed #48 recovery/workflow, production authority/runtime/domain/Buzz and the actual system run remain pending. [PR59](https://github.com/NetRxn/Inertia/pull/59) is a noncanonical discussion reference, not an adopted workflow or scope change. [#40](https://github.com/NetRxn/Inertia/issues/40) remains the coordination source.

Public Inertia develop includes [PR53](https://github.com/NetRxn/Inertia/pull/53) with source-qualified, default-disabled owning-host assembly, early SDK pre-buffer byte/deadline bounds, manual-only native invocation and native state-delete cursor reset. The independently reviewed all-PostgreSQL reproduction is published in [PR52](https://github.com/NetRxn/Inertia/pull/52). Live admission still requires bounded receipt-read allocation, remaining adapter/deployment/latency compatibility, approved lifecycle/authentication/network bindings, production writer fencing and the live human walkthrough. [Draft PR51](https://github.com/NetRxn/Inertia/pull/51) is outside that baseline. [Implementation status](spec.md#implementation-status) and the [qualification record](testing.md#qualification-record) distinguish merged, fixture-qualified and live states.


Shared recovery and rehearsal changes require mutual agreement with their contributors before adoption. The simpler same-pending-ID re-entry in draft PR62 is a candidate, not an agreed shared workflow; it adds no retirement endpoint, new store or payload persistence. [PR60](https://github.com/NetRxn/Inertia/pull/60) has a scoped re-review pass awaiting its contributor’s readiness/nonblocking-note choice. [PR61](https://github.com/NetRxn/Inertia/pull/61) still awaits its action-surface clarification and R-02 alignment. Preserve those isolated contributor-owned files. [PR59](https://github.com/NetRxn/Inertia/pull/59) remains discussion-only.

## Settled decisions

| ID | Decision | Consequence |
|---|---|---|
| D01 | Wednesday outcomes are meeting publication and a substantial system-generated application packet, including agent contribution, exact-version member review and SQL knowledge reuse | Do not substitute a manually polished reference packet for actual system output. |
| D02 | Meet/video → Gemini → organization Drive | Integrate actual outputs once access contract is known. |
| D03 | Automatic cleaned transcript and notes publication | Routine in-policy publication is automatic. |
| D04 | Preserve source fidelity and audience | Version outputs, retain source and read back publication. |
| D05 | Reuse DAO PlanetScale PostgreSQL for funding and meetings | One relational database; isolated domain schemas and service roles. Paperclip DB remains independent. |
| D06 | Reuse existing grant scanner | Qualify its current interfaces and refresh stale opportunities. |
| D07 | Vocdoni/DAO governance applies when the actual operative policy requires it | Do not impose a universal final-packet vote or invented sponsor signature gate. |
| D08 | Ordinary tasks proceed under their configured authority | Reserve governance review for the decisions that require it. |
| D09 | Y2 is deferred from the Wednesday demo critical path | Preserve the future adapter objective and stable R-Y01/NTF10 IDs. |
| D10 | Paperclip is the operational platform | Use its CEO, hiring, hierarchy, tasks and decisions. |
| D11 | Buzz and dashboard are alternative interfaces | Share IDs, permissions and state in both directions. |
| D12 | Agents eagerly acquire work and create follow-ups | Configure native autonomy, budgets and follow-up constraints. |
| D13 | Full untrusted member-owned client execution remains a separate later lane | Qualify real sandbox/data isolation and server validation before admission; the authorized Buzz demo path proves none of those by implication. |
| D14 | Reuse existing authorized runtime/tools for Wednesday and existing hardening for later untrusted execution | Preserve separate execution-isolation qualification rather than adding it to the current critical path. |
| D15 | PostgreSQL-native knowledge is the Wednesday baseline using existing authorized SQL domain tools | Helix is explicitly deferred; retain future adapter reversibility and source/access guarantees. |
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
| P05 | Preserve actual domain correctness through native/Buzz member actions | Chosen v2 allows any currently verified DAO member with current application action access. No named owner or default five specialist human gates. Packet core/native capture are merged; draft UI/live integration remains pending and v1 remains historical. |

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
| U07 | Deferred Y2 interface | Future account/changefeed/scope/replay contract; not a current-critical input | Deferred / not Wednesday |
| U08 | Achievable contribution path | Existing authorized Buzz agent and application-scoped tools for Wednesday; full untrusted member runtime/isolation is separate | Engineering / actual-path qualification |
| U09 | Confirm operational budgets before live runs | Default: Paperclip owns scheduling; no duplicate Buzz routine; new hiring requires configured native authority. Conservative bounded retries and task limits in fixture configuration | Engineering / live admission |
| U10 | Hosting and inference | Deploy Paperclip as part of Inertia; connect the existing target Buzz instance. Resolve inference/Cloudflare fit and deployment configuration | Inertia engineering / deployment |
| U11 | Current application example and achievable backup | System-generated substantial NSF preparation is sufficient for that case; choose a current achievable backup and recheck availability/requirements | Preparation team / Wednesday evidence |
| U12 | Wednesday Roundtable and Friday deadline | Operational goal October 28; Friday October 30 submission 11:00am CDT. Confirm participants, recording and actual presentation slot without reopening settled scope | Coordinator / operational inputs |
| U13 | Current DAO membership and application action access | Trusted identity/membership/application ACL and exact-version confirmation; no named reviewer owner or default five role grants | Application operator + engineering / v2 live qualification |
| U14 | Shared DAO database readiness | Verify deployed PostgreSQL version, provider schema/role/backup/PostGIS support, current stores, collision inventory and Drizzle/Alembic ownership; qualify restore and cutover | DAO database + domain owners / before migration |
| U15 | SQL knowledge binding and bounded inventory | Reuse existing authorized PostgreSQL domain tools and admitted source IDs/scopes. Helix compatibility/backfill is deferred | Domain + engineering / Wednesday SQL qualification |

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
| D33 | Use Vocdoni and any actual final-action stages when the DAO decision genuinely requires governance. Verify the operative example rather than inventing a universal packet-vote ceremony. |
| D34 | Contribution and approval depend on current authenticated DAO/application access, not repository administration. Wednesday can use the existing authorized Buzz agent; full untrusted member-owned isolation remains a separate unqualified path. |
| D30 | Aim for latest Paperclip releases. The existing pin identifies the reproducible security/build evaluation baseline; qualify newer releases for promotion. Qualify candidate compatibility, package, migrations and smoke tests; promote with a tested pre-upgrade database restore path and prior runtime. |
| D29 | Cloud-first development and verification; authorized laptop Docker is sufficient for local development with the user’s own credentials. John plans the shared deployment before Wednesday. The source-checkout workflow demo remains a deterministic, explicitly synthetic journey and receipt. |
| D28 | Package version 0.1.0 targets public SDK 2026.1012.0 and Node 24.11.0+. Qualify the actual archive in a fresh production-only install, including a native JSON-RPC worker handshake. Keep development commands in the source checkout. |
| D27 | Keep routine operation automatic after one-time setup. Recover transient faults silently; report only material results, permanent setup failures or unresolved mutation outcomes with a concrete next action. |
| D26 | Private hardening implementation stays outside public artifacts; integrate through public execution contracts. Qualify and deploy the execution layer through its own lifecycle. |
| D35 | Retrieve organizational/financial facts from existing authorized sources first. Documents not publicly obtainable require protected organizational sources or a team-supplied reference. Preserve versions/citations/audience; do not ask again for settled architecture or governance choices. |

Alternatives considered: latest native chat-provider implementation offers broader built-in connector lifecycle but adds version/admission work; a custom standalone task service duplicates Paperclip. The narrow plugin wins on immediate usefulness and reduced maintenance. Transport functions remain separable so a future native provider can reuse verified event handling.

## Integration decisions

- D36: Keep the website caller and website server rollout distinct. The merged caller uses the proposed v1.1 clarification without changing the v1 wire/digest versions. Reject metadata-only corrections until both sides support a metadata-bound versioned codec.
- D37: Use the concrete authenticated cloud deployment checklist. Qualification in isolated local-trusted fixtures never authorizes a publicly exposed or unauthenticated production host.
- D38: Public applicant facts remain attributed review inputs, never eligibility proof. Resolve conflicting governance sources through operative ratification evidence for vote thresholds and signing authority.
- D39: The selected native outbound slice mirrors eligible comments only, default-off with explicit binding audience approval/start time, using the existing durable outbox/reconciler. PR 17 is reviewed/tested and merged into develop. PR 16 supplies the native operator setup checklist; automatic intake still needs an explicitly assigned mandate and authorized live setup. General status mirroring remains future.

- D40: Use the shared funding harness for substantial research and application preparation. Native/Buzz views expose the same packet and member actions. Any verified member with current application action access may contribute; agents perform quality review, never human approval.
- D41: Use an explicit versioned v2 member-confirmation policy for new work, with current identity/membership/application action access and exact immutable packet/artifact binding. No named owner or default specialist-human gates. V2 core/native capture are merged; draft UI and live authority/domain/Buzz integration remain pending; preserve v1 approvals, receipts and cancellation history unchanged.
- D42: Corrections produce a new exact packet/version and confirmation. Mark submitted records a selected immutable packet/date and reporter/evidence level, with optional later receipt evidence. It records a past fact, not an external submission or fabricated prior approval.

- D43: Consolidate funding and meeting relational data in one existing DAO PostgreSQL database, with separate domain schemas and least-privilege roles. Keep Paperclip native persistence independent. Choose physical server placement during deployment and qualify provider capabilities before migration.
- D44: Keep Drizzle responsible for DAO website/meeting tables and Alembic for funding tables, with non-overlapping schema scope and separate migration histories. No shared all-powerful application role or competing migration owner. See [consolidation plan](docs/development/dao-data-consolidation.md).
- D45: Use authorized PostgreSQL domain knowledge tools for Wednesday. Helix is deferred, not required for the demo. Preserve authoritative source/history/access checks and reversible future derived adapters; no SQL integration is claimed deployed.

## Funding and objective delivery decisions

- D46: Extend existing funding services with an assigned preparation agent and independent agent quality review. Specialist work is delegated as needed, without naming a human application owner.
- D47: Produce useful machine-reviewed candidates before human confirmation. Accepted facts, proposed work and commitments remain distinct. Current member/application access governs exact-version v2 confirmation; unavailable private facts and genuine decisions are grouped after useful agent work.
- D48: Reuse the existing SQL evidence/admission and sanitized financial foundation. Bind the actual organizational/financial source tools and current scopes; provider compatibility and actual private document access remain operational inputs, not a reason to copy private records into public artifacts.
- D49: Every website innovation-bounty submission enters the general Paperclip queue. Keep versioned objective/funding links in the funding domain, separate from project status.
- D50: Use one structured DAO opportunity brief across native documents and permitted portal/Buzz views. Separate application, delivery and reporting effort. Meeting outcomes update knowledge and follow-up work.
- D51: Preserve portable skill/proposal contracts. Wednesday qualifies the existing authorized Buzz agent path; support for every Codex/Claude/local or untrusted member-owned runtime is not a prerequisite for that bounded demonstration.
- D52: Continue authorized implementation in cloud. Inertia feature branches target develop; DFW-Gov-Fund feature branches target main. Preserve review, required checks and repository-specific merge authorization.
- D53: Measure actual system-generated preparation separately from reference packets/answer keys. Record elapsed and active human time, observable cost, corrections and evidence coverage. Park Place approximately one hour is user-reported elapsed historical context, not measured automation or active time.

- D54: Agents perform researchable work and prepare concrete options before requesting missing private documents or actual authority. An assigned preparation agent is not a named human application owner; existing application access governs collaboration.
- D55: Require benchmark v3 evidence of preparation sufficiency, action support, decision precision and remaining agent work. Reassess the five examples against v3 preparation and handoff criteria. Distinguish merged implementation, reviewed local work and live model/deployment qualification.

- D56: Query saved partners and evidence before new research. Every scan/diligence result includes a durable useful knowledge delta or explained no-change receipt; preserve reusable findings even when an opportunity is rejected.
- D57: Cover the bounded authorized SQL source inventory needed for the selected application, keeping canonical IDs and explicit unresolved outcomes. Full Helix/graph backfill is deferred; relationship/evidence/delivery distinctions remain required.
- D58: Preserve transactional authoritative evidence/history, payload-safe replay, source/scope admission and concurrency checks. The earlier Helix/outbox core remains historical work. Any later derived adapter still needs qualified fencing/recovery/removal/rebuild behavior; it is not a Wednesday dependency.
- D59: Seed fixtures exercise program/legal-entity and alias disambiguation, evidenced collaboration and planned versus completed work. Legal/tax status, document availability and opportunity eligibility remain separate evidence needs. Concrete source records stay with their owner until admitted for the intended audience.
- D60: Keep July case improvement, October 23 manual findings, dated replay and actual scanner output separate. October discovery is complete and PR42 is merged with passing post-merge CI. Use the delivered priority diligence queue for actionable preparation while preserving the exact confidence overlay and source limits.

- D61: Run bounded query-first research and useful writeback through existing authorized SQL/domain tools for Wednesday. Operational recurrence, broader discovery automation and Y2 remain later live-admission work; the daily schedule remains disabled.

- D62: Legacy v1 durable acceptance keeps its exact-command authority, current domain checks and DFW-confirmed cancellation semantics. New v2 member review has distinct merged packet primitives, with current DAO/application action access and exact-version binding. Native capture is now merged source; do not reinterpret legacy records or claim live v2 transport/domain apply.
- D63: Retention planning choices are settled: recordings after validated transcript/minutes, expendable drafts and operational logs use 90-day defaults; security logs one year. Meaningful reviewed/final/submitted and authoritative records remain retained under archive/grant rules and holds. Binding, record owner and grant-specific schedule are operational inputs. No deletion is enabled.

- D64: Use explicit trusted Meet/Drive bindings, verified FILE_GENERATED readiness and unchanged Drive versions for meeting sources. Persist exact publication operations before I/O and reuse native intake for reference-only follow-up. Summary-only sources never become transcripts; notes-only website output remains R-M02 partial. The merged job stays default-disabled pending source/server and installation admission.

- D65: Source-bound discovery preserves exact provenance, conservative conditional facts and independently established eligibility. Wednesday uses the existing authorized agent and SQL tools. Actual delivery/model quality still needs measured evidence; relay acceptance is not human reading and recurrence stays disabled.

- D66: The existing authorized Buzz agent is the achievable Wednesday contribution path. PR37 only stages inert candidates; PR51 is draft ingress/per-attempt authority. Full untrusted isolation and native authoritative completion remain unqualified engineering work and must not be implied by the trusted path.

- D67: Retain the legacy v1 capture/transport division and exact receipt readback/cancellation history. New v2 current-member native/Buzz actions require their own explicit versioned policy and qualification; no live v2 transport is claimed.

- D68: Reuse current verified DAO membership and application action ACLs for v2. Do not create named-owner or default five-specialist reviewer setup as a prerequisite. Engineering implements trusted action checks and exact-version confirmation; operational administrators supply actual access/source bindings.

## Current execution clarification

Use the [recommended remaining work](plan.md#recommended-remaining-work) as a concise Pareto task list, not a new owner/dependency/handoff register. The first two proposals are with John; hold a new external split until his review is clear.

Two-provider funding and general member/bounty scenarios test existing R-F/R-K/R-I/R-C requirements and native coordination. Keep the provider/role roster configurable across research, partner discovery, assembly and review. Reuse Paperclip’s coordinator, issues, checkout and budgets; add no dispatcher/framework. Two John-owned agents are not two independent humans.

For this run, laptop Docker with the user’s own credentials is a sufficient local development route. John plans the shared deployment before Wednesday. New sign-in still needs exact approval; the cloud read-only-home failure does not establish an API-key requirement.

## Chosen demo week priorities

The operational target is Wednesday October 28 Roundtable with PostgreSQL knowledge and the existing authorized Buzz agent. Helix and Y2 are explicitly deferred. Actual system research/preparation and a near-complete current application draft are required; an independently prepared reference packet is not a substitute. Another agent contribution belongs within that packet outcome. NSF exemplary preparation and an achievable current backup are sufficient; no automatic extra submission. Friday October 30 at 11:00am CDT remains the event deadline. NTF15/T-J01–06 retain participant/video/source verification. Checked-in judging weights remain defaults, not verified live settings.

## Settled retention planning choices

These planning choices are settled. Storage binding, record ownership, holds, readable archive and grant-specific schedules remain operational inputs. No deletion is enabled or authorized by this design revision.

- Raw recordings: 90 days after a validated transcript and minutes exist.
- Approved minutes/decisions and authoritative evidence transcripts: long-term archive. Retain reusable facts with provenance and access scope.
- Expendable drafts: 90 days. Meaningful reviewed/final/submitted records remain retained under the organization/grant-specific schedule and holds.
- Operational logs: 90 days. Security logs: one year.

Keep legacy accepted receipts through terminal acknowledgement or qualified durable transfer. Preserve readable archives and meaningful records under applicable holds/schedules; operational binding does not reopen the settled defaults.

## Change log

r24 adds the recommended Pareto task order, existing-requirement scenario mapping and local-development/shared-deployment distinction without new requirements or contributor assignments. r23 records merged native capture, reviewed draft Packet UI and noncanonical discussion/contributor status without adopting a shared recovery workflow. r22 recorded packet-v2 and named SQL-tool source before native capture merged. r21 recorded the finalized Wednesday PostgreSQL/Buzz path, explicit Helix/Y2 deferral, current-member exact-version v2 policy, simple submission attestation, settled retention defaults and actual-system measurement. V2 packet core has since merged; native/Buzz and real authority integration remain pending. Stable IDs and legacy records are preserved; prior review/minimization and source-qualified PR53 status remain valid history.

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
