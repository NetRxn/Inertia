# Funding implementation source map

Revision: FUNDING-2026-10-23-r4. Status recorded 2026-10-24 UTC.
Updated: 2026-10-24 (UTC)

## Pinned delivery state

Inertia’s native adapter is merged/default-disabled in PR28; DFW `NativeFundingReviewService` is reviewed/in CI for PR47. The approved exact-version authority-at-acceptance model requires an acceptance/reconciliation seam and production writer qualification. The frozen through-commit slice remains disabled until replaced.

- Native-review service candidate: DFW `74e1dfc1d40cddc593899964ddb5d25e7fc5f95f`, [PR47](https://github.com/NetRxn/DFW-Gov-Fund/pull/47), [CI40043004931](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/40043004931) found one deadline-date boundary failure between UTC and Chicago business dates. Repair is underway; merge requires passing CI. Inertia candidate `d729e045ce2a64217bcea04acd8f97627a9aaf3c` is merged in PR28. Both sides remain default-disabled; the approved successor semantics are recorded below.
- DFW main: `16e96b22d55caaa0c19513e121028ab78c3aa1c7`, tree `bf95bf9ece1aba19004ad51a06227723161cd03b` ([PR46](https://github.com/NetRxn/DFW-Gov-Fund/pull/46)). Public drafting/gaps, Task 6, graph core, cloud tooling/race qualification and objective links/briefs are merged.
- Historical portable-skills qualification at `c615525291a656f9abd4da1262c23fa8ae97290c`: [CI 39999694731](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/39999694731): all steps passed for the exact PR40 qualification head. Offline Codex install/cache refresh verified; live model execution remains the next qualification step.
- Public drafting plus actionable gaps: merged. Historical pre-merge patch SHA-256 `aae99bc899ca7805d6d8f5092efc77ccb58bcb06b766f8dae7350cdeeb0c8483`; exact historical validation remains below.
- Inertia develop: `6f93cfef486b017afccda7b275837e09213aa189`, tree `93b93bd527e6d120f69a7bb41ec692dc38353f90` ([PR28](https://github.com/NetRxn/Inertia/pull/28)). PR25/26/27 include cumulative core, cloud qualification/race fixes and Task 8; PR28 adds the default-disabled native adapter. The synchronized r16/funding r4 artifact refresh remains unpublished.
- Task 6 `dao-knowledge-v1`: merged. Historical local patches: DFW SHA-256 `322b77e6f43383e23c0e9df3103d905a8f8f3729dfa7c81c9f60c804d85d3b60`; Inertia SHA-256 `ac9d2b76de58bf065fa598119a9d93db71f69b23986f361094f64e0098407cc6`. Production source/financial-adapter activation remains pending.
- October discovery: complete and merged in [PR42](https://github.com/NetRxn/DFW-Gov-Fund/pull/42) at `e5a146398e4aa2e808e445be102a255f04f5265d`; [post-merge CI 40036012817](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/40036012817) passed. Temporary live jobs are removed. The [priority diligence queue](https://github.com/NetRxn/DFW-Gov-Fund/blob/main/government-funding-dfw/docs/discovery/2026-10-23-priority-diligence.md) was delivered as an initial snapshot, SHA-256 `e2ff7dc6fade650932fb28f6d62984142d25e7b1c65f2c98a164d9eda46b5ce2`. Apply current owner priorities and deferrals before further preparation.
- Partner-graph core: merged. Historical pre-merge patches: DFW SHA-256 `164e6a688bb4a7a41f7516086d65500f22534310435872070584b9673a2176cf`; Inertia SHA-256 `bb53a7a124884e75518621accb1079f7b5da8c68e88093fa29dbc60f7abb802f`. Real PG-to-embedded-Helix cloud rehearsal subsequently passed.
- Paperclip evaluated release: `v2026.1012.0`, commit `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`. Requalify the selected deployment version.

## DFW implementation boundaries

Paths are relative to `government-funding-dfw/`. Merged runtime slices and the default-disabled native-review upload retain their distinct delivery states recorded above.

| Paths | Current behavior |
|---|---|
| `quality_benchmark.py`, `tests/fixtures/funding_quality/` | Merged frozen-case evaluator; merged continuation adds v3 prepared-handoff judgments. Five cases/eight captured requirements remain partial; full inventory/gold admission pending |
| `draft_candidates.py`, `codex_agents.py`, existing drafting/rendering services | Merged source-bound candidates and independent review rendering; accepted facts remain separate |
| `requirement_review.py`, `agents/review.py`, `packet_handoff.py` | Merged structured route/ownership and whole-application completeness |
| `public_drafting.py` | Merged candidate-only scoped public workspace/save factory, trusted reviewer/repair adapters, bounded repairs and durable continuation |
| `gap_actions.py` | Merged candidate-only source-bound preparation and exact gap-plan review using the same reviewer port |
| `models.py` / `WorkbenchAuditEvent` | Existing audit records persist candidate links, research checkpoints and review receipts; no parallel scheduler or approval ledger |
| `.agents/skills/dfw-funding-orchestrator/`, `plugins/dfw-funding-dfw/`, installer/runtime verifier | Merged 3.4.1 canonical content, portable/Claude/Codex wrappers, skills-only default and compatible aliases |
| `docs/public-drafting-continuation.md`, `docs/actionable-funding-gaps.md` | Merged host, persistence and v3 quality contracts |
| `organization_knowledge.py`, `financial_snapshots.py`, model/migration 0014 and related document/rendering services | Merged Task 6 exact evidence, trusted admission, scoped selection/history/invalidation and sanitized USD Profit & Loss fixture normalization |
| `docs/organization-knowledge-contract.md`, `docs/financial-snapshot-contract.md` | Task 6 contract revision dao-knowledge-v1; real disposable PG passed; production importer/roles and financial-source compatibility remain pending |
| `native_review.py`, `packet_review_context.py`, `tests/test_native_funding_review.py` | Tested default-disabled native funding transaction service; native-source and production writer-fence composition remain activation gates |
| `config/scouts/2026-10-23-sources.yaml`, `docs/discovery/2026-10-23-*`, profile/IRS evidence and discovery/qualification modules | Merged October discovery; selected-scope acquisition complete, confidence overlay preserved and priority diligence queue delivered |

Python module names above live under `src/dfw_incentives/`. Use the current source definitions for exact interface names. Existing document/evidence, numeric validation and packet/signoff services remain owners of those functions.

## Inertia seams and ownership

`src/roundtable/ingestion.ts` produces unverified extractive notes. Adopted decisions require trusted admission. `src/roundtable/website.ts` owns publication/readback contracts. `src/grants/{contracts,engine,governance}.ts` bind exact domain packet/artifact/review hashes and vote evidence. Native integration seams are `src/paperclip/adapter.ts`, `src/worker.ts` and `src/manifest.ts`.

Merged Task 6 adds `src/roundtable/knowledge.ts` and 50 tests without changing existing ingestion/publication sources. It extracts source-linked candidates; trusted import/admission remains a host integration. Helix ingestion/query core is merged and independently reviewed; authenticated source wiring and production qualification remain pending.

Paperclip owns tasks, hiring, execution and review UI; Buzz exposes the same work. DAO PostgreSQL owns domain evidence/history and the merged transactional graph outbox, with separate migration ownership/roles. Paperclip's DB stays separate. Helix is the core indexed partner graph with typed assertions, query-first durable writeback and projector/query tools merged and independently reviewed. Objective intake/briefs are merged; production source/host/service integration, admitted inventory/backfill, native-review fences and operational discovery activation remain work. Broader 990 and optional vectors come later.

## Quality and qualification

Independent one-command cloud rehearsal passed DFW PostgreSQL 17.11/PostGIS 3.5.2 domain qualification (65 tests), Paperclip 2026.1012.0 native PostgreSQL 18 services and real PG-to-embedded-Helix reuse/writeback. Native inbox/outbox race fixes and cloud tooling are merged. Full HTTP/UI remains blocked by `os.networkInterfaces` / `uv_interface_addresses`; PPC2/VPS executor admission, live-member enrollment and production deployment remain future gates.

Task 8 is merged in Inertia PR27 and DFW PR46. Qualified-base evidence: 362 Inertia tests, typecheck/build and seven-migration native-service recovery passed; DFW recorded 906 passed, five skipped and one protected missing-PPTX manifest failure in the local snapshot. The separate synthetic actual-service meeting-answer → scoped knowledge → follow-up → revised-brief rehearsal passed independent review; its portable supplement is being packaged.

The frozen native-review adapter remains default-disabled: native session loss can release source locks before a separate funding transaction commits. The approved successor records durable authority for an exact command/version at native acceptance, surviving disconnect. Funding-service confirmation establishes cancellation; changed funding evidence blocks stale execution; grant submission remains separate. Implement and qualify the acceptance/reconciliation seam and production writer-fence composition before activation.

Portable meeting supplement candidate: 400/400 combined tests, typecheck and build passed. Publication is next; the separately qualified synthetic meeting-answer rehearsal remains the delivered evidence.

### Historical pre-merge qualification

The historical bridge/gap candidate recorded 451 passing local tests and one manifest failure for a missing pre-existing PPTX in the snapshot. Its manifest entry is preserved. Independent focused review passed 125 tests. Ruff, mypy (100 source files), compileall and build passed. That receipt remains scoped to its candidate. The merged implementation still needs actual model semantics and production host authorization.

Task 6 validation: DFW full suite 624 passed with the same missing-PPTX manifest failure; 55 knowledge/118 financial tests, Ruff, strict mypy (102 files), compileall, build, locked audit and SQLite 0014 up/down/up passed. Inertia 298/298 plus typecheck/build/package/module smoke passed. Independent review approved the bounded implementation after 254 DFW focused/integration tests and the Inertia checks. Real disposable PostgreSQL qualification subsequently passed; production roles, trusted importer and actual QuickBooks compatibility remain pending.

October discovery final validation: 608 passed and one skip; post-merge CI 40036012817 passed. All eight selected scopes completed acquisition: 222 documents, 220 representations and 216 routed rows (208 monitor, eight reject). Preserve the exact confidence overlay and keep scanner dispositions separate from the delivered human-reviewed priority diligence queue. Historical repair validation recorded 558 passed, one private-snapshot skip and the missing-PPTX failure; private replay/receipt checks passed eight. The initial DNS-failed scout, 33 manual findings and dated replay retain their separate evidence records. Manual supplemental sources and unqualified automated routes retain the limits stated in the [priority queue](https://github.com/NetRxn/DFW-Gov-Fund/blob/main/government-funding-dfw/docs/discovery/2026-10-23-priority-diligence.md).

Historical partner-graph local validation: final Inertia suite 332 passed; final DFW suite 650 passed, four skipped and one inherited missing-PPTX manifest failure. Independent review cleared the bounded local core; production-release qualification remains pending. Actual Helix SDK 3.1.0/embedded runtime 0.3.3 and Python SQLite rehearsal exercised query-first writeback, rejected-opportunity reuse, revocation and tombstone/replay behavior. Real disposable PostgreSQL subsequently passed. Authenticated production source/host adapters, deployed Helix, admitted inventory/backfill and complete live workflow remain qualification gates. Subsequent clean-package and dependency-audit checks passed; the original core receipt remains historical.

Benchmark v3 supersedes the earlier v2 assessment of 5/5 useful fields and 14 genuine requests. Reassess preparation, source support, exact remaining decisions and remaining agent work before reporting current acceptance. Exact July replay remains separate from current public enrichment.

## Partner and IRS seed evidence

Evidence observed/reconciled on October 23, 2026; graph seeds remain proposals and the authorized inventory is not imported.

- DAO EIN **41-2815082**, exact official name **FORT WORTH DAO LCA**: [IRS Colorado BMF](https://www.irs.gov/pub/irs-soi/eo_co.csv) records subsection 03, status 01 and foundation code 16; [IRS Pub. 78](https://apps.irs.gov/pub/epostcard/data-download-pub78.zip) has the exact EIN row with PC/public-charity code. The merged discovery record stores exact rows/hashes in `profiles/fort-worth-dao/evidence/2026-10-23-irs-records.yaml`. The determination-letter attachment remains uncollected; the Lakewood filing address is separate from Fort Worth program delivery. Dataset zero financial fields do not establish current assets/revenue.
- [MADE](https://www.techfortworth.org/made-manufacturing-accelerator) is a TechFW program. The [TechFW team](https://www.techfortworth.org/team) supplies public work roles; a public role alone does not prove direct DAO collaboration or relationship ownership.
- [Moonshot](https://moonshotus.com/) is the electrical/data-center manufacturer; its precise contracting entity remains unresolved. John confirms existing collaboration and the October 30 closing-host role, which remains planned.
- [LiquidAcre](https://liquidacre.com/) is the exact brand, with LiquidAcre, LLC named in its [terms](https://www.liquidacre.com/terms-of-use). John confirms collaboration and the [DAO HackFW post](https://www.linkedin.com/posts/fwtx-dao_fort-worth-talent-network-fwtx-dao-activity-7495201798526349313-JK2G) tags the brand. Preserve the spoken “Liquid Acres” mention as a candidate alias until admitted; do not name-merge an unrelated company.
- [HackFW](https://hack.fwtx.city/) runs October 1–30; [kickoff](https://luma.com/ycw304lf) and [Demo Day](https://luma.com/ygyxb4yy) establish advertised dates. John's report that MADE cohosted the opening is separate collaboration/delivery evidence. An event date alone never establishes completion.

### Helix implementation references

Implementation checkpoint: the bounded graph core is merged and independently reviewed. Official Helix TypeScript SDK **3.1.0** and embedded runtime **0.3.3** exercised actual index activation, conditional transactions, fencing/replay and scoped retrieval, including Python SQLite export → Helix rehearsal. Deployed-service and shared-gateway qualification remain pending. Production PostgreSQL role/writer composition, authenticated source adapters, actual inventory/backfill and live integration remain next.

Official [HTTP API](https://docs.helix-db.com/database/helix-db/query-guides/http-api), [write operations](https://docs.helix-db.com/database/helix-db/query-guides/writing-data), [secondary indexes](https://docs.helix-db.com/database/helix-db/query-guides/secondary-indexes), [tenancy](https://docs.helix-db.com/database/helix-cloud/operate/multi-tenancy) and [consistency guarantees](https://docs.helix-db.com/database/helix-cloud/operate/guarantees) inform the adapter. Pin the selected SDK/runtime and qualify the required atomic fence/revision guard and active indexes. Enforce application-level tenant filtering together with source/audience revalidation.

## Public preparation example

Begin with the DAO/HackFW relationship path through MADE/TechFW, then evaluate the relevant employer/training partner. For SDF, TCC Corporate Solutions provides an official [contact route](https://corporate.tccd.edu/contact/). Agents prepare employer-needs/course-cost worksheets, role options and exact evidence requirements. The DAO then selects a project and decides whether to authorize an introduction. Contacts and relationship evidence support research. Sending messages and promising participation require separate authorization.

## Reference contracts

- Inertia: `docs/development/native-grant-workflow.md`, `docs/development/dao-data-consolidation.md`, website publication proposal and v1.1 clarifications.
- [Agent Skills](https://agentskills.io/specification), [Agent Plugins](https://agent-plugins.org/specification), [Claude plugins](https://code.claude.com/docs/en/plugins).
- [Paperclip managed skills](https://docs.paperclip.ing/reference/skills/) and [governed MCP](https://docs.paperclip.ing/connectors/custom-mcp-servers/); qualify the selected release/configuration.

No deployment, migration, credential change, external outreach or submission is performed by this artifact update.
