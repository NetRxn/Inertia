# Inertia decisions

Revision: INERTIA-2026-10-22-r6
Updated: 2026-10-22 (UTC)
Stage: Connected bridge and Roundtable core merged; domain integration in progress.


## Implementation evidence at r6

| Slice | State | Verified evidence | Next acceptance |
|---|---|---|---|
| Signed Buzz transport | Merged into develop | [PR 2](https://github.com/NetRxn/Inertia/pull/2), 36 tests; canonical signatures, NIP98, stable retry IDs, bounded responses and deferred Retry-After | Exercise the configured relay during live admission |
| Native authority and durable records | Merged into develop | [PR 3](https://github.com/NetRxn/Inertia/pull/3), combined 60 tests; real SDK types, PGlite SQL, atomic inbox/outbox and host query validation | Live host/relay admission and domain integration |
| Connected plugin | Merged into develop | [PR 4](https://github.com/NetRxn/Inertia/pull/4), 85 tests, typecheck/build/demo; durable retry, lookback/backfill, scoped health and addressed confirmation-card privacy | Live host/relay admission and domain integration |
| Roundtable core | Merged into develop | [PR 5](https://github.com/NetRxn/Inertia/pull/5), 23 Roundtable tests; combined repository suite 108 passing; source revisions, extractive quote grounding and deterministic materialization | Actual website publisher/readback and live source integration |
| Grant/vote, Y2 and member participation | Grant slice active; remaining adapters planned | Existing systems and public interfaces identified | Implement adapters and complete the three-outcome rehearsal |

Merged baseline: develop `1d41eeb70b02275a488a7f7583c116c8d2c77f3c`, 22 October 2026. Combined verification: 108 tests, typecheck, build and synthetic connected demo passed after PRs 4 and 5. Fixture tests use real cryptography and SQL with substituted external I/O. Live setup and rehearsal remain on the delivery path.


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
| P01 | Build a bounded TypeScript plugin bridge against the existing public SDK pin | Paired-human comments and accept/reject interactions already exist; avoid forced upgrade for latest chat-provider APIs. |
| P02 | Route Buzz task triggers into one native execution owner | Duplicate-trigger and checkout tests. |
| P03 | Reuse existing execution hardening through native runner/plugin interfaces | Version, license, lifecycle and isolation qualification. |
| P04 | Use native connection profiles and tool policy | Domain credential scopes and call-time authorization tests. |
| P05 | Preserve existing grant review/signoff semantics | Current scanner interface and packet schema review. |

## Central configuration and compatibility register

All unresolved external setup is tracked here; implementation tasks link these IDs rather than repeating disclaimers.

| ID | Resolve | Evidence needed | Owner / gate |
|---|---|---|---|
| U01 | Public SDK package resolution and eventual serving admission | Source baseline selected: v2026.1012.0 / bba6a45f0d364cfd962ac59b3bdf2426a8222adb. Record package integrity and actual live allowlist separately | Engineering / build and deployment |
| U02 | Existing execution-hardening compatibility and reuse permissions | Version pin, license/authorization, supported lifecycle, isolation and deployment evidence | Engineering qualification / G1 |
| U03 | Buzz instance, runtime route and identity pairing | Supported bridge API, relay endpoints, paired human/agent rules, owner-author configuration | Integration owner / G2 |
| U04 | Drive publication contract | Folder IDs, actual Gemini output types, readiness, audience and retention | DAO administrator / G2 |
| U05 | DAO publication interface and access | Create/upsert/readback API, document storage audience guarantees and test target | Website owner / G2 |
| U06 | Vote adapter | Chain/network, proposal payload, eligibility/finality verification and packet binding | Governance owner / G2 |
| U07 | Y2 access | Subscription/API, registration/update identity, rate limits and demo data | Y2 teammate / G2 |
| U08 | Member participation topology | Named agent versus shared capacity, enrollment/revocation, data classes and capabilities | User + engineering / G2 |
| U09 | Confirm operational budgets before live runs | Default: Paperclip owns scheduling; no duplicate Buzz routine; new hiring requires configured native authority. Conservative bounded retries and task limits in fixture configuration | Engineering / live admission |
| U10 | Hosting and inference | Local/OpenAI-compatible runtime choice, Cloudflare service fit, deployment ownership | Engineering / G2 |
| U11 | Current grant demo candidate | Fresh scan, deadline, eligibility, direct/partner route and approved DAO facts | Grant owner / G3 |
| U12 | Delivery staffing and final date details | Named owners, capacity, proposed October 29 rehearsal buffer and October 30 submission logistics | User / G2 |

No live instance credentials are needed in these public artifacts. Record connection references in the platform's protected configuration.

## Audit interpretation

Current public source shows substantial orchestration, chat, interaction, runner and credential primitives. The architecture should configure and extend these. Compatibility must distinguish 'API exists' from 'the chosen serving build admits that operation.' Native hiring titles do not grant policy automatically; plugins are trusted extensions; on-chain quorum requires its own verified evidence.

## Autonomous build defaults

The user explicitly requested autonomous progress, best practice and simplicity, and a frictionless implementation/maintenance experience. Resolve reversible engineering choices without waiting for another review ceremony. Keep security-sensitive live access and consequential external actions separately controlled.

| ID | Decision and rationale |
|---|---|
| D18 | Node 24, TypeScript ESM, npm/Vitest and real public SDK types. This follows Paperclip's language and keeps a single small package easy to run. |
| D19 | First route is the pinned SDK plugin bridge. A latest native-chat provider remains a future migration option when justified, not a simultaneous implementation. |
| D20 | Real signed Nostr event verification and NIP98 HTTP transport, injected I/O for tests. No caller-provided trusted flags or simulated cryptographic checks. |
| D21 | Native plugin PostgreSQL stores bridge receipts/bindings; native Paperclip stores work/decision state. Atomic unique writes handle concurrency; transport persistence is not a competing scheduler. |
| D22 | Source signature identifies a key, not a human role. Trusted one-time pairing and apply-time native authorization establish authority. |
| D23 | Comment mutations with lost responses reconcile through a stable source marker. Unknown outcomes are held rather than blindly retried. Interactions use native convergence; edited pending content needs safe replacement/CAS. |
| D24 | Fixture demo is usable with one command. Minimal health reports connection/backlog and a concrete corrective action. No bespoke dashboard. |
| D25 | develop is the integration branch; feature branches and reviewed tested merges are authorized. Preserve main and existing user changes. |
| D27 | Keep routine operation automatic after one-time setup. Recover transient faults silently; report only material results, permanent setup failures or unresolved mutation outcomes with a concrete next action. |
| D26 | Private hardening implementation stays outside public artifacts; integrate through public execution contracts. The bridge does not qualify or deploy the execution layer. |

Alternatives considered: latest native chat-provider implementation offers broader built-in connector lifecycle but adds version/admission work; a custom standalone task service duplicates Paperclip. The narrow plugin wins on immediate usefulness and reduced maintenance. Transport functions remain separable so a future native provider can reuse verified event handling.

## Change log

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
