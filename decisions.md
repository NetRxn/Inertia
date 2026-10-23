# Inertia decisions

Revision: INERTIA-2026-10-23-r9
Updated: 2026-10-23 (UTC)
Stage: PR 17 merged into develop; exact runtime archive native-qualified. Live deployment and domain admission remain pending.


## Implementation evidence at r9

| Slice | State | Verified evidence | Next acceptance |
|---|---|---|---|
| Signed Buzz transport | Merged into develop | [PR 2](https://github.com/NetRxn/Inertia/pull/2), 36 tests; canonical signatures, NIP98, stable retry IDs, bounded responses and deferred Retry-After | Exercise the configured relay during live admission |
| Native authority and durable records | Merged into develop | [PR 3](https://github.com/NetRxn/Inertia/pull/3), combined 60 tests; real SDK types, PGlite SQL, atomic inbox/outbox and host query validation | Configured relay admission and live domain integration |
| Connected plugin | Merged into develop | [PR 4](https://github.com/NetRxn/Inertia/pull/4), 85 tests, typecheck/build/demo; durable retry, lookback/backfill, scoped health and addressed confirmation-card privacy | Configured relay admission and live domain integration |
| Roundtable core | Merged into develop | [PR 5](https://github.com/NetRxn/Inertia/pull/5), 23 Roundtable tests; 108 combined tests at PR 5; source revisions, extractive quote grounding and deterministic materialization | Website caller merged in PR 14; deployed server/source/job admission pending |
| Grant packet binding | Merged into develop | [PR 7](https://github.com/NetRxn/Inertia/pull/7), 37 grant tests; 145 combined tests at PR 7, typecheck/build and grant fixture demo pass | Production exporter, chain verifier and transactional native acceptance |
| Package and setup | Merged into develop | [PR 8](https://github.com/NetRxn/Inertia/pull/8), 149 tests, typecheck/build; clean production install and real native JSON-RPC worker handshake pass | Deploy the qualified plugin and configure authorized targets |
| Connected workflow rehearsal | Merged into develop | [PR 10](https://github.com/NetRxn/Inertia/pull/10), 152 tests and five demos pass; independently reviewed three workflow tests, typecheck/build/demo/diff | Replace explicit fixture seams with tested live adapters |
| Historical native service qualification | Passed for its recorded pre-mirror artifact | [Qualification receipt](docs/qualification/native-services.md): actual plugin loader, real PostgreSQL, four plugin migrations/eight tables, worker initialization and three registered jobs; disabled configuration validates | HTTP/API qualification also passed in the authorized isolated Docker fallback; external/live integrations remain pending |
| Latest-release qualification | Merged into develop | [PR 11](https://github.com/NetRxn/Inertia/pull/11): official registry discovery, isolated exact-lock qualification, 12 focused tests plus actual 152 runtime tests/typecheck/production package verification | Qualify each new candidate with native/HTTP checks and tested database recovery before promotion |
| Y2 and member participation | Planned required product slices | Existing systems and public interfaces identified | Implement adapters and complete the three-outcome rehearsal |

Merged baseline: develop `4841f7ade1510acf93e43ce1dbd16b91ae7bcd88`, 23 October 2026, through PR 17. PR 14 final verification passed 216 tests, typecheck and build; the original connected workflow and Roundtable demos remain explicitly synthetic. Earlier package/native/HTTP receipts qualify their recorded source baselines, not every later runtime change. No live website, cloud deployment or member integration has been admitted. PR 17 merged at 11:12:50 UTC from exact reviewed head `2a90ce24e16a72f446a7402560bd53d22f00ca38`, with 248 passing combined tests. The merge preserves its reviewed source bytes. The qualified archive/source-tree hashes below remain the evidence identity; this documentation revision does not retroactively qualify a new artifact.

## Overnight integration status

- **Website caller implemented, live publication pending.** [PR 14](https://github.com/NetRxn/Inertia/pull/14) adds exact-body operation persistence, read-before-write reconciliation, CAS corrections, full audience/content readback, bounded HTTP and actionable authentication/rate-limit outcomes. The reviewed final suite passed 216 tests. These are mocked-I/O contract checks, not deployed website acceptance. The existing demos still use `pendingDaoPublisher`.
- **Website contract remains proposed.** The [v1 proposal](docs/integrations/dao-website-member-publication-proposal.md) and [v1.1 clarification](docs/integrations/dao-website-publication-v1.1-clarifications.md) retain `roundtable-publication-v1` / `extractive-v1`. Metadata-only corrections are explicitly unsupported until a new versioned codec binds metadata. Website rollout, credentials, authorized Drive readiness and single-owner native job wiring remain admission gates.
- **Cloud setup has a concrete handoff.** [PR 13](https://github.com/NetRxn/Inertia/pull/13) specifies one authenticated private Paperclip host, durable PostgreSQL and the existing Buzz service. Owner-approved target/origin, relay thread, native company/identity pairing and signing-secret reference are still required. No deployment, credentials or live call are implied by the plan.
- **Public grant grounding is a review reference.** [PR 15](https://github.com/NetRxn/Inertia/pull/15) pins organization-published facts and provenance. It does not import applicant records or clear eligibility. Legal/tax claims need primary verification; conflicting constitutional and proposed governance rules need authenticated canonical holdings and ratification evidence.
- **Native comment mirroring is merged and tested.** [PR 17](https://github.com/NetRxn/Inertia/pull/17), head `2a90ce24e16a72f446a7402560bd53d22f00ca38`, passed 248 combined tests, typecheck/build and package verification. It merged into develop as `4841f7ade1510acf93e43ce1dbd16b91ae7bcd88`. First-publication mirroring is default-off and per-binding, with explicit `audienceAcknowledged` approval and `notBefore` history cutoff. It reuses the existing outbox/reconcile job. Delivered posts have no edit/delete propagation; suppression cannot retract uncertain prior relay acceptance. Non-expiring publication claims remain visible as `inFlightPublications`; exceptional token-matched recovery requires proving all prior workers stopped. General status mirroring remains future work.
- **The exact candidate passed native-service qualification.** [Receipt and reproduction](docs/qualification/combined-native-services/README.md) bind archive SHA-256 `19e67c88a8de52404412e49312cebfd6db42c462de3378cf3397966250add76c` to source tree `8039b3e5f54e49c302b4751445f382403381ab91`: six migrations, eight tables, three job RPCs, expected disabled health, real SQL binding and clean shutdown against unmodified Paperclip 2026.1012.0/PostgreSQL 18.1. A host array-binding regression was found and fixed before this pass. This is native-service evidence, not full HTTP/UI or live integration qualification. Earlier HTTP evidence remains historical.
- **Native CEO setup uses existing controls.** [PR 16](https://github.com/NetRxn/Inertia/pull/16) adds an operator checklist, not a bootstrap engine or live setup. Select the existing CEO by native ID and give it a bounded assigned intake issue. The shipped heartbeat does not discover arbitrary unassigned work. Use native run policy, budgets and hiring approvals; choose one native recurring mechanism rather than overlapping routine/heartbeat loops. Record the admitted run and delegated issue IDs during the authorized pilot.



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

The earlier 'Paperclip-style candidate UI' becomes actual Paperclip operations. The generic bespoke task ledger, scheduler, approval store, credential manager and workspace manager are replaced by native integration as the default. A demonstrated interface gap may justify a narrowly scoped adapter, with evidence and tests recorded here. Buzz is not a parallel work engine.

## Selected integration decisions

| ID | Proposal | Decision evidence |
|---|---|---|
| P01 | Build a bounded TypeScript plugin bridge against a qualified public SDK release | Paired-human comments and accept/reject interactions already exist. The initial evaluation baseline is reproducible; regularly qualify latest releases without building a parallel chat engine. |
| P02 | Route Buzz task triggers into one native execution owner | Duplicate-trigger and checkout tests. |
| P03 | Reuse existing execution hardening through native runner/plugin interfaces | Version, license, lifecycle and isolation qualification. |
| P04 | Use native connection profiles and tool policy | Domain credential scopes and call-time authorization tests. |
| P05 | Preserve existing grant review/signoff semantics | Current scanner interface and packet schema review. |

## Central configuration and compatibility register

All unresolved external setup is tracked here; implementation tasks link these IDs rather than repeating disclaimers.

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

No live instance credentials are needed in these public artifacts. Record connection references in the platform's protected configuration.

## Current integration facts

- The DAO meeting UI’s authenticated access is broader than active DAO membership. The required target is members-only portal publication. Implement and verify active-membership authorization before publishing; login alone is insufficient. The website API/schema/contracts are a proposal for the user to roll out.
- [Documented governance route](https://documentation.robsrulesdao.com/aragon) identifies FWTX Aragon enablement and a Vocdoni-to-Aragon process. Vocdoni is selected and the user will supply an actual example. Treat Aragon/final settlement as a verification question for that example, not a newly imposed mandatory platform. The Polygon network example for another DAO is not FWTX configuration.
- A governance provider must verify the effective final decision across all required stages before returning accepted authority. The generic core can consume that outcome; an FWTX-specific verifier is still integration work.

## Audit interpretation

Current public source shows substantial orchestration, chat, interaction, runner and credential primitives. The architecture should configure and extend these. Compatibility must distinguish 'API exists' from 'the chosen serving build admits that operation.' Native hiring titles do not grant policy automatically; plugins are trusted extensions; on-chain quorum requires its own verified evidence.

## Autonomous build defaults

The user explicitly requested autonomous progress, best practice and simplicity, and a frictionless implementation/maintenance experience. Resolve reversible engineering choices without waiting for another review ceremony. Keep security-sensitive live access and consequential external actions separately controlled.

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

## Additional r9 decisions

- D36: Keep the website caller and website server rollout distinct. The merged caller uses the proposed v1.1 clarification without changing the v1 wire/digest versions. Reject metadata-only corrections until both sides support a metadata-bound versioned codec.
- D37: Use the concrete authenticated cloud deployment checklist. Qualification in isolated local-trusted fixtures never authorizes a publicly exposed or unauthenticated production host.
- D38: Public applicant facts remain attributed review inputs, never eligibility proof. Conflicting governance sources require operative ratification evidence; do not guess vote thresholds or current signing authority.
- D39: The selected native outbound slice mirrors eligible comments only, default-off with explicit binding audience approval/start time, using the existing durable outbox/reconciler. PR 17 is reviewed/tested and merged into develop. PR 16 supplies the native operator setup checklist; automatic intake still needs an explicitly assigned mandate and authorized live setup. General status mirroring remains future.

## Change log

- r9: Synchronize the reviewed website caller, proposed v1.1 limits, authenticated cloud handoff and public DAO grounding. Record PR 17’s reviewed 248-test candidate and exact native-service receipt while keeping live deployment outside this evidence.
- r8: Add the connected workflow rehearsal, deterministic receipt and native-service evidence; adopt cloud-first execution and latest-release maintenance through repeatable qualification and tested database recovery.
- r7: Record merged grant packet binding, minimum Node 24.11+ and verified package/setup delivery. Preserve the production exporter, chain verifier, native transactional acceptance and website publisher as explicit integration work.
- r6: Select compatibility-backed thin bridge; define signed transport, SDK adapter, durable receipts, recovery tests, autonomous develop workflow and frictionless operator UX.
- r5: Adopt actual Paperclip platform and shared Buzz UI, eager acquisition and follow-up creation; add reuse matrix, bridge contracts, targeted tests, compatibility-first gates and a single external configuration register.
- r4: Establish public repository delivery and synchronized artifacts with unchanged original overview.

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

## Publication gate

PRs 13–17 are merged into develop `4841f7ade1510acf93e43ce1dbd16b91ae7bcd88`. The r9 documents and editable deck synchronize that implementation state. Runtime qualification remains tied to the recorded archive hash, not this new documentation tree. Live deployment, credentials and enabling comment exports remain separate authorized steps.
