# Funding implementation source map

Revision: FUNDING-2026-10-23-r3. Status recorded 2026-10-23 UTC.

## Pinned delivery state

- DFW main: `c615525291a656f9abd4da1262c23fa8ae97290c`, portable skills 3.4.1. Merged [PR35 CI](https://github.com/NetRxn/DFW-Gov-Fund/pull/35), [PR37 benchmark](https://github.com/NetRxn/DFW-Gov-Fund/pull/37), [PR38 candidates](https://github.com/NetRxn/DFW-Gov-Fund/pull/38), [PR39 route review](https://github.com/NetRxn/DFW-Gov-Fund/pull/39) and [PR40 portable skills](https://github.com/NetRxn/DFW-Gov-Fund/pull/40).
- [CI 39999694731](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/39999694731): all steps passed for the exact PR40 qualification head. Offline Codex install/cache refresh verified; live model execution remains the next qualification step.
- Public drafting plus actionable gaps: reviewed, awaiting publication. Combined patch SHA-256 `aae99bc899ca7805d6d8f5092efc77ccb58bcb06b766f8dae7350cdeeb0c8483`, based on the main commit above. Publication and merge remain pending.
- Inertia artifact source: r14 Markdown from develop `1ac44a7a5c9d8e1376e2c358ee2888b16be58905`, tree `ef24b4c7e7554e51b52610c0ad7b5ca62e619d80`, assembled with the later repaired visual artifacts. Refresh the remote base before publication; this revision changes artifacts only.
- Task 6 `dao-knowledge-v1`: implemented and independently approved locally, unpublished/not live. DFW patch SHA-256 `322b77e6f43383e23c0e9df3103d905a8f8f3729dfa7c81c9f60c804d85d3b60`; Inertia patch SHA-256 `ac9d2b76de58bf065fa598119a9d93db71f69b23986f361094f64e0098407cc6`. Reapply these reviewed local content patches to freshly verified remote heads.
- October discovery: published in [draft PR42](https://github.com/NetRxn/DFW-Gov-Fund/pull/42), head `a342ab1cd38e2e6f65a98c2c582b14d70fa5adae`, on `discovery/2026-10-23-refresh`. All 45 remote blobs were verified; [CI and bounded qualification run](https://github.com/NetRxn/DFW-Gov-Fund/actions/runs/40027003050) is active: the probe finished and deterministic CI is running. Reviewed patch SHA-256 `e988f9c1b1da13f94e973b32eeaa4ba0344ea186c2c09824a4adb7ef82c51b4c`, based on the DFW main pin above. Final live scout and per-source acceptance remain pending.
- Paperclip evaluated release: `v2026.1012.0`, commit `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`. Requalify the selected deployment version.

## DFW implementation boundaries

Paths are relative to `government-funding-dfw/`. Published draft and locally reviewed changes retain the delivery status recorded above.

| Paths | Current behavior |
|---|---|
| `quality_benchmark.py`, `tests/fixtures/funding_quality/` | Merged frozen-case evaluator; reviewed candidate adds v3 prepared-handoff judgments. Five cases/eight captured requirements remain partial; full inventory/gold admission pending |
| `draft_candidates.py`, `codex_agents.py`, existing drafting/rendering services | Merged source-bound candidates and independent review rendering; accepted facts remain separate |
| `requirement_review.py`, `agents/review.py`, `packet_handoff.py` | Merged structured route/ownership and whole-application completeness |
| `public_drafting.py` | Candidate-only scoped public workspace/save factory, trusted reviewer/repair adapters, bounded repairs and durable continuation |
| `gap_actions.py` | Candidate-only source-bound preparation and exact gap-plan review using the same reviewer port |
| `models.py` / `WorkbenchAuditEvent` | Existing audit records persist candidate links, research checkpoints and review receipts; no parallel scheduler or approval ledger |
| `.agents/skills/dfw-funding-orchestrator/`, `plugins/dfw-funding-dfw/`, installer/runtime verifier | Merged 3.4.1 canonical content, portable/Claude/Codex wrappers, skills-only default and compatible aliases |
| `docs/public-drafting-continuation.md`, `docs/actionable-funding-gaps.md` | Candidate-only host, persistence and v3 quality contracts |
| `organization_knowledge.py`, `financial_snapshots.py`, model/migration 0014 and related document/rendering services | Task 6 locally reviewed exact evidence, trusted admission, scoped selection/history/invalidation and sanitized USD Profit & Loss fixture normalization |
| `docs/organization-knowledge-contract.md`, `docs/financial-snapshot-contract.md` | Task 6 contract revision dao-knowledge-v1; live importer, real PG and actual financial-source compatibility remain pending |
| `config/scouts/2026-10-23-sources.yaml`, `docs/discovery/2026-10-23-*`, profile/IRS evidence and discovery/qualification modules | Separate October repair/research/replay candidate; guarded cloud source qualification underway, final live scout pending |

Python module names above live under `src/dfw_incentives/`. Use the current source definitions for exact interface names. Existing document/evidence, numeric validation and packet/signoff services remain owners of those functions.

## Inertia seams and ownership

`src/roundtable/ingestion.ts` produces unverified extractive notes. Adopted decisions require trusted admission. `src/roundtable/website.ts` owns publication/readback contracts. `src/grants/{contracts,engine,governance}.ts` bind exact domain packet/artifact/review hashes and vote evidence. Native integration seams are `src/paperclip/adapter.ts`, `src/worker.ts` and `src/manifest.ts`.

Task 6 adds locally reviewed `src/roundtable/knowledge.ts` and 50 tests without changing existing ingestion/publication sources. It extracts source-linked candidates; trusted import/admission remains a host integration. Helix ingestion/query work is under implementation as a separate core slice.

Paperclip owns tasks, hiring, execution and review UI; Buzz exposes the same work. DAO PostgreSQL owns domain evidence/history and the planned transactional graph outbox, with separate migration ownership/roles. Paperclip's DB stays separate. Helix is the core indexed partner graph under implementation. Typed assertions, query-first durable writeback, projector/query tools, trusted native human-decision effects, general intake/brief and live rehearsal remain implementation work. Broader 990 and optional vectors come later.

## Quality and qualification

The reviewed bridge/gap candidate has 451 passing local tests and one manifest failure for a missing pre-existing PPTX in the snapshot. Its manifest entry is preserved. Independent focused review passed 125 tests. Ruff, mypy (100 source files), compileall and build passed. Complete-tree remote CI, live model semantics, host authorization and PostgreSQL concurrency remain unverified for this candidate.

Task 6 validation: DFW full suite 624 passed with the same missing-PPTX manifest failure; 55 knowledge/118 financial tests, Ruff, strict mypy (102 files), compileall, build, locked audit and SQLite 0014 up/down/up passed. Inertia 298/298 plus typecheck/build/package/module smoke passed. Independent review approved the bounded implementation after 254 DFW focused/integration tests and the Inertia checks. Real PG concurrency/roles, trusted importer and actual QuickBooks compatibility remain pending.

October discovery validation: 558 passed, one private-snapshot skip and the missing-PPTX manifest failure; private page replay/receipt checks 8 passed. The first actual scout failed public DNS before acquisition, with zero records/candidates. Manual research has 33 findings, separately labeled from replay and scanner output; its knowledge delta remains proposed/not ingested. The remote fixed-source probe fetched/parsed 8 of 10 sources: seven known-page scopes are complete; Grants.gov yielded 25 sample opportunities with explicit one-page incomplete coverage. Autodesk and ParkPlace remain unqualified pending error review. Receipt review and deterministic CI continue; the dated scout remains pending.

Benchmark v3 supersedes the earlier v2 assessment of 5/5 useful fields and 14 genuine requests. Reassess preparation, source support, exact remaining decisions and remaining agent work before reporting current acceptance. Exact July replay remains separate from current public enrichment.

## Partner and IRS seed evidence

Evidence observed/reconciled on October 23, 2026; the graph import is planned.

- DAO EIN **41-2815082**, exact official name **FORT WORTH DAO LCA**: [IRS Colorado BMF](https://www.irs.gov/pub/irs-soi/eo_co.csv) records subsection 03, status 01 and foundation code 16; [IRS Pub. 78](https://apps.irs.gov/pub/epostcard/data-download-pub78.zip) has the exact EIN row with PC/public-charity code. The discovery candidate stores exact rows/hashes in `profiles/fort-worth-dao/evidence/2026-10-23-irs-records.yaml`. The determination-letter attachment remains uncollected; the Lakewood filing address is separate from Fort Worth program delivery. Dataset zero financial fields do not establish current assets/revenue.
- [MADE](https://www.techfortworth.org/made-manufacturing-accelerator) is a TechFW program. The [TechFW team](https://www.techfortworth.org/team) supplies public work roles; a public role alone does not prove direct DAO collaboration or relationship ownership.
- [Moonshot](https://moonshotus.com/) is the electrical/data-center manufacturer; its precise contracting entity remains unresolved. John confirms existing collaboration and the October 30 closing-host role, which remains planned.
- [LiquidAcre](https://liquidacre.com/) is the exact brand, with LiquidAcre, LLC named in its [terms](https://www.liquidacre.com/terms-of-use). John confirms collaboration and the [DAO HackFW post](https://www.linkedin.com/posts/fwtx-dao_fort-worth-talent-network-fwtx-dao-activity-7495201798526349313-JK2G) tags the brand. Preserve the spoken “Liquid Acres” mention as a candidate alias until admitted; do not name-merge an unrelated company.
- [HackFW](https://hack.fwtx.city/) runs October 1–30; [kickoff](https://luma.com/ycw304lf) and [Demo Day](https://luma.com/ygyxb4yy) establish advertised dates. John's report that MADE cohosted the opening is separate collaboration/delivery evidence. An event date alone never establishes completion.

### Helix implementation references

Implementation checkpoint: official Helix TypeScript SDK **3.1.0** and embedded runtime **0.3.3** are installed; a real embedded query passed. Core implementation and tests are underway. Typed writeback, fenced projection, scoped queries and end-to-end acceptance remain pending.

Official [HTTP API](https://docs.helix-db.com/database/helix-db/query-guides/http-api), [write operations](https://docs.helix-db.com/database/helix-db/query-guides/writing-data), [secondary indexes](https://docs.helix-db.com/database/helix-db/query-guides/secondary-indexes), [tenancy](https://docs.helix-db.com/database/helix-cloud/operate/multi-tenancy) and [consistency guarantees](https://docs.helix-db.com/database/helix-cloud/operate/guarantees) inform the adapter. Pin the selected SDK/runtime and qualify the required atomic fence/revision guard and active indexes. Enforce application-level tenant filtering together with source/audience revalidation.

## Public preparation example

Begin with the DAO/HackFW relationship path through MADE/TechFW, then evaluate the relevant employer/training partner. For SDF, TCC Corporate Solutions provides an official [contact route](https://corporate.tccd.edu/contact/). Agents prepare employer-needs/course-cost worksheets, role options and exact evidence requirements. The DAO then selects a project and decides whether to authorize an introduction. Contacts and relationship evidence support research. Sending messages and promising participation require separate authorization.

## Reference contracts

- Inertia: `docs/development/native-grant-workflow.md`, `docs/development/dao-data-consolidation.md`, website publication proposal and v1.1 clarifications.
- [Agent Skills](https://agentskills.io/specification), [Agent Plugins](https://agent-plugins.org/specification), [Claude plugins](https://code.claude.com/docs/en/plugins).
- [Paperclip managed skills](https://docs.paperclip.ing/reference/skills/) and [governed MCP](https://docs.paperclip.ing/connectors/custom-mcp-servers/); qualify the selected release/configuration.

No deployment, migration, credential change, external outreach or submission is performed by this artifact update.
