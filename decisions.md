# Inertia decisions

Revision: INERTIA-2026-10-23-r10
Updated: 2026-10-23 (UTC)
Status: implementation merged; live integration pending.


## Current baseline

Develop `f9423e5`; runtime through PR 17. See [implementation status](spec.md#implementation-status) and the exact [qualification record](testing.md#qualification-record). Live deployment and domain admission are pending.

## Settled decisions

| ID | Decision | Consequence |
|---|---|---|
| D01 | Three required outcomes: meetings, grant vote, member contribution | Preserve all three through planning. |
| D02 | Meet/video → Gemini → organization Drive | Integrate actual outputs once access contract is known. |
| D03 | Automatic cleaned transcript and notes publication | Routine in-policy publication is automatic. |
| D04 | Preserve source fidelity and audience | Version outputs, retain source and read back publication. |
| D05 | DAO uses PlanetScale PostgreSQL | Reuse existing website persistence. |
| D06 | Reuse existing grant scanner | Qualify its current interfaces and refresh stale opportunities. |
| D07 | Blockchain voting is settled | Bind final authority to an immutable packet. |
| D08 | Ordinary tasks can proceed without a vote | Do not route every website or research action through governance. |
| D09 | Y2 remains a demo integration objective | Teammate ownership makes access worth resolving early. |
| D10 | Paperclip is the operational platform | Use its CEO, hiring, hierarchy, tasks and decisions. |
| D11 | Buzz and dashboard are alternative interfaces | Share IDs, permissions and state in both directions. |
| D12 | Agents eagerly acquire work and create follow-ups | Configure native autonomy, budgets and follow-up constraints. |
| D13 | Member agents execute client-side securely | Qualify sandbox, data isolation and server validation. |
| D14 | Reuse native/existing hardening first | Qualify existing execution hardening against the selected Paperclip release. |
| D15 | Helix de-prioritized; 990 integration stretch | No graph dependency on the core critical path. |
| D16 | Cloudflare is available | Select services only when deployment needs justify them. |
| D17 | Keep four Markdown files and deck synchronized | Preserve original PDF; use focused Git commits and existing PR. |

## Superseded proposals

Paperclip supplies operations, scheduling, task/approval state, credentials and workspace lifecycle. Add a narrow adapter only for a demonstrated interface gap, with evidence and tests recorded here. Buzz presents native work.

## Selected integration decisions

| ID | Proposal | Decision evidence |
|---|---|---|
| P01 | Build a bounded TypeScript plugin bridge against a qualified public SDK release | Paired-human comments and accept/reject interactions already exist. The initial evaluation baseline is reproducible; regularly qualify latest releases without building a parallel chat engine. |
| P02 | Route Buzz task triggers into one native execution owner | Duplicate-trigger and checkout tests. |
| P03 | Reuse existing execution hardening through native runner/plugin interfaces | Version, license, lifecycle and isolation qualification. |
| P04 | Use native connection profiles and tool policy | Domain credential scopes and call-time authorization tests. |
| P05 | Preserve existing grant review/signoff semantics | Current scanner interface and packet schema review. |

## Central configuration and compatibility register

Implementation tasks reference these setup IDs.

| ID | Resolve | Evidence needed | Owner / gate |
|---|---|---|---|
| U01 | Public SDK package resolution and eventual serving admission | Reproducible tested baseline: v2026.1012.0 / bba6a45f0d364cfd962ac59b3bdf2426a8222adb. Target latest releases through repeatable qualification; record package integrity and serving admission | Engineering / build and deployment |
| U02 | Existing execution-hardening compatibility and reuse permissions | Version pin, license/authorization, supported lifecycle, isolation and deployment evidence | Engineering qualification / G1 |
| U03 | Buzz instance, runtime route and identity pairing | Supported bridge API, relay endpoints, paired human/agent rules, owner-author configuration | Integration owner / G2 |
| U04 | Drive publication contract | Folder IDs, actual Gemini output types, readiness, audience and retention | DAO administrator / G2 |
| U05 | DAO publication interface and access | Existing meeting actions require a valid Privy session, not active DAO membership. Target is members-only behind the portal. Current login-only access must gain explicit active-membership checks alongside atomic upsert/readback; prepare the API/schema proposal, user owns rollout | Website owner / integration |
| U06 | Effective multi-stage vote authority | Vocdoni is selected; user will supply an example. Verify whether documented Aragon/final-action stages apply to that actual workflow, then require effective authority and exact packet/action binding. Confirm chain/network from the example | Governance owner / integration |
| U07 | Y2 account and application access | Public API/changefeed route is agreed. Confirm account authorization, registration/update identity, visibility, rate limits and demo data | Y2 teammate / integration |
| U08 | Member participation topology | Named agent versus shared capacity, enrollment/revocation, data classes and capabilities | User + engineering / G2 |
| U09 | Confirm operational budgets before live runs | Default: Paperclip owns scheduling; no duplicate Buzz routine; new hiring requires configured native authority. Conservative bounded retries and task limits in fixture configuration | Engineering / live admission |
| U10 | Hosting and inference | Deploy Paperclip as part of Inertia; connect the existing target Buzz instance. Resolve inference/Cloudflare fit and deployment configuration | Inertia engineering / deployment |
| U11 | Current grant demo candidate | Fresh scan, deadline, eligibility, direct/partner route and approved DAO facts | Grant owner / G3 |
| U12 | Delivery staffing and final date details | Named owners, capacity, proposed October 29 rehearsal buffer and October 30 submission logistics | User / G2 |

Keep credential references in protected platform configuration.

## Compatibility criteria

Verify API availability and serving-build admission separately. Native hiring requires configured policy. Plugins are trusted code; execution isolation requires separate qualification. On-chain authority requires verified packet-bound evidence.

## Autonomous build defaults

Resolve reversible engineering choices autonomously. Obtain required authorization for live access and consequential external actions.

| ID | Decision and rationale |
|---|---|
| D18 | Node 24.11+, TypeScript ESM, npm/Vitest and real public SDK types. This follows Paperclip's language and keeps a single small package easy to run. |
| D19 | First route is the pinned SDK plugin bridge. A latest native-chat provider remains a future migration option when justified, not a simultaneous implementation. |
| D20 | Real signed Nostr event verification and NIP98 HTTP transport, injected I/O for tests. No caller-provided trusted flags or simulated cryptographic checks. |
| D21 | Native plugin PostgreSQL stores bridge receipts/bindings; native Paperclip stores work/decision state. Atomic unique writes handle concurrency; transport persistence is not a competing scheduler. |
| D22 | Source signature identifies a key, not a human role. Trusted one-time pairing and apply-time native authorization establish authority. |
| D23 | Comment mutations with lost responses reconcile through a stable source marker. Unknown outcomes are held rather than blindly retried. Interactions use native convergence; edited pending content needs safe replacement/CAS. |
| D24 | Fixture demo is usable with one command. Minimal health reports connection/backlog and a concrete corrective action. No bespoke dashboard. |
| D25 | develop is the integration branch; feature branches and reviewed tested merges are authorized. Preserve main and existing user changes. |
| D31 | Roundtable outputs publish behind the members-only portal, not publicly. Explicit active-membership enforcement is required; the website API/schema/contracts are proposed here and the user owns rollout. |
| D32 | Use the existing target Buzz instance and deploy Paperclip as part of Inertia. |
| D33 | Vocdoni is the selected voting route. The user supplies an example; verify applicable final-action/settlement stages before treating a vote as effective authority. |
| D34 | A second rehearsal participant will have repository-admin access. Enroll its agent with scoped DAO permissions separately; repository authority grants no automatic DAO-system privileges. |
| D30 | Aim for latest Paperclip releases. The existing pin is a reproducible security/build evaluation baseline, not permanent version policy. Qualify candidate compatibility, package, migrations and smoke tests; promote with a tested pre-upgrade database restore path and prior runtime. |
| D29 | Cloud-first development and verification. The laptop is a fallback for a specific cloud blocker or required platform check; local Docker checks require a specific authorized fallback. A source-checkout workflow demo supplies a deterministic, explicitly synthetic journey and receipt. |
| D28 | Package version 0.1.0 targets public SDK 2026.1012.0 and Node 24.11.0+. Qualify the actual archive in a fresh production-only install, including a native JSON-RPC worker handshake. Keep development commands in the source checkout. |
| D27 | Keep routine operation automatic after one-time setup. Recover transient faults silently; report only material results, permanent setup failures or unresolved mutation outcomes with a concrete next action. |
| D26 | Private hardening implementation stays outside public artifacts; integrate through public execution contracts. The bridge does not qualify or deploy the execution layer. |
| D35 | Treat the DAO website as the authoritative organizational knowledge source. Retrieve governance and formation evidence using the deployed agent’s authorized access; preserve citations, versions and restrictions. Ask for manual facts only after retrieval reveals a gap. |

Alternatives considered: latest native chat-provider implementation offers broader built-in connector lifecycle but adds version/admission work; a custom standalone task service duplicates Paperclip. The narrow plugin wins on immediate usefulness and reduced maintenance. Transport functions remain separable so a future native provider can reuse verified event handling.

## Integration decisions

- D36: Keep the website caller and website server rollout distinct. The merged caller uses the proposed v1.1 clarification without changing the v1 wire/digest versions. Reject metadata-only corrections until both sides support a metadata-bound versioned codec.
- D37: Use the concrete authenticated cloud deployment checklist. Qualification in isolated local-trusted fixtures never authorizes a publicly exposed or unauthenticated production host.
- D38: Public applicant facts remain attributed review inputs, never eligibility proof. Conflicting governance sources require operative ratification evidence; do not guess vote thresholds or current signing authority.
- D39: The selected native outbound slice mirrors eligible comments only, default-off with explicit binding audience approval/start time, using the existing durable outbox/reconciler. PR 17 is reviewed/tested and merged into develop. PR 16 supplies the native operator setup checklist; automatic intake still needs an explicitly assigned mandate and authorized live setup. General status mirroring remains future.

## Change log

- r10: Condense current artifacts, centralize evidence and retain requirements, decisions and acceptance gates.
- r9: Synchronize the reviewed website caller, proposed v1.1 limits, authenticated cloud handoff and public DAO grounding. Record PR 17’s reviewed 248-test candidate and exact native-service receipt while keeping live deployment outside this evidence.
- r8: Add the connected workflow rehearsal, deterministic receipt and native-service evidence; adopt cloud-first execution and latest-release maintenance through repeatable qualification and tested database recovery.
- r7: Record merged grant packet binding, minimum Node 24.11+ and verified package/setup delivery. Preserve the production exporter, chain verifier, native transactional acceptance and website publisher as explicit integration work.
- r6: Select compatibility-backed thin bridge; define signed transport, SDK adapter, durable receipts, recovery tests, autonomous develop workflow and frictionless operator UX.
- r5: Adopt actual Paperclip platform and shared Buzz UI, eager acquisition and follow-up creation; add reuse matrix, bridge contracts, targeted tests, compatibility-first gates and a single external configuration register.
- r4: Establish public repository delivery and synchronized artifacts with unchanged original overview.

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

## Publication gate

Publish the reviewed Markdown, editable deck and visual diagrams together. Preserve qualification receipts, runtime archive and original PDF. Live deployment and credential setup require separate authorization.
