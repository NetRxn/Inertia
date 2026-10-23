# Funding enhancement implementation plan

Revision: FUNDING-2026-10-23-r3.

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax.

**Goal:** Deliver useful public-only applications, maintained indexed partner knowledge and query-first research writeback within the shared objective-to-funding workflow.
**Architecture:** DFW-Gov-Fund owns evidence, candidates, packets and domain decisions. Inertia connects website/meeting sources and native Paperclip work/review. Paperclip owns execution and human interaction.
**Tech stack:** Existing Python/SQLAlchemy/Alembic/FastMCP funding core; TypeScript/Paperclip SDK integration; existing DAO PostgreSQL with isolated domain schemas.
**Spec:** [spec.md](spec.md) in this design package; cross-repository implementation references this contract.

## Global constraints

- Cloud execution; no laptop dependency for implementation.
- Preserve existing IDs, accepted facts, approval meanings and compatibility aliases.
- No new organization database or parallel task/approval ledger.
- No credentials, financial commitments, submissions or live deployments as implementation side effects.
- Public-only enrichment and historical replay are separately measured.
- Preserve independent review and server-enforced scope.
- Preserve immutable acquisition provenance; B2 discovery alone cannot publish a canonical opportunity.
- Do not infer current availability from a standing program page or direct eligibility from mission fit.

## Review focus

1. Plausible but unsupported claims and mismatched numeric evidence: task 2.
2. Changed source or revoked audience after drafting: tasks 2, 6 and 7.
3. Two decisions racing against a new packet: task 7.
4. Replayed intake, edited source and failed acknowledgment: task 8.
5. A host accepts package metadata but never supplies tools/skills to its agent: task 5.

## Repository and branch discipline

DFW paths below are relative to `government-funding-dfw/`; Inertia paths are repo-relative. Existing paths are verified in source-map.md; all other paths are explicitly **new**. Before editing, read repository instructions and refresh the selected base. Use separate feature branches/worktrees and small reviewed commits. Inertia feature branches target develop; DFW-Gov-Fund feature branches target main. Coordinate publication and expected-head merges while preserving branch-protection and credential settings. Keep CI changes separate from drafting changes.

## Task 0: Restore the executable baseline

- [x] Reconcile the six vulnerable locked packages within compatible constraints. Review the actual lock diff alongside the Dependabot reports.
- [x] Run locked audit, compile, Ruff, mypy, full pytest, build and SQLite migration smoke on the selected baseline. Record checks that cannot execute.
- [x] Use PR checks, the repository integration-branch pushes and manual dispatch; cancel superseded runs per PR/ref. Keep essential checks. Avoid path filters until their required-check behavior is proven.
- [x] Review and commit this separately. Current evidence identifies duplicated push/PR runs and dependency audit failures.

Current status: PR35 merged at `ac483c309d1df84dec8a8106ec5f13860e080fc0`; exact-head run 39987898544 passed. Subsequent merged work is included in version 3.4.1 main `c615525291a656f9abd4da1262c23fa8ae97290c`, qualified by run 39999694731.

## Task 1: Freeze measurable public-only cases

**State:** benchmark implementation merged in PR37. Five public cases cover eight captured requirements. Sponsor inventories remain partial and independent gold admission is pending. The reviewed actionable-gap candidate upgrades the rubric to v3. Next, reassess the five examples against its preparation and handoff criteria.

**Files:** `src/dfw_incentives/quality_benchmark.py`, `tests/test_funding_quality_benchmark.py`, `tests/fixtures/funding_quality/`.

- [x] Implement immutable fixture/candidate/evidence bindings, fixed captured denominators, deterministic checks separated from semantic assessments, independent votes and adjudication records.
- [x] Keep current public, synthetic and exact historical tracks separate; reject historical claims without archived inputs.
- [ ] Complete sponsor inventories, admit gold independently and reassess actual outputs under v3 preparation/action-support/decision-precision criteria.
- [ ] Run `uv run --locked pytest tests/test_funding_quality_benchmark.py -q`; retain field scores, reviewer versions, disagreements, cost and elapsed time for live comparisons.

## Task 2: Produce useful, scoped draft candidates

**State:** useful candidate/review rendering merged in PR38. Scoped public drafting, independent review, targeted repair and durable continuation are reviewed, awaiting publication.

**Files:** `src/dfw_incentives/{draft_candidates,codex_agents,public_drafting}.py`, existing drafting/artifact services; `tests/test_draft_candidates.py`, `tests/test_public_drafting.py` and regression suites.

- [x] Bind candidate claims to exact requirements and source spans; render them separately from accepted applicant facts and retain numeric evidence validation.
- [x] Review the scoped `PublicDraftingService`/`create_public_funding_mcp` bridge. Host-owned identities and public-source admission exclude private fields, credentials and signoff tools. Save unaccepted suggestions; freeze review inputs; allow at most two targeted repairs.
- [x] Verify checkpointed suggestions/reviews/repairs, interruption recovery, replay deduplication and current-source rejection with controlled trusted adapters.
- [ ] Publish the reviewed candidate and pass full complete-tree CI. Configure actual host reviewer/repair adapters and evaluate live semantic quality before claiming runtime qualification.
- [ ] Preserve `tests/test_grounded_drafting.py`, `tests/test_codex_agents.py` and actual Markdown/DOCX rendering checks.

## Task 3: Route-aware completeness and independent review

**State:** structured route/ownership assessment merged in PR39. The reviewed bridge supports trusted independent candidate and source-bound gap-plan review.

**Files:** `src/dfw_incentives/requirement_review.py`, existing `agents/review.py`, `packet_handoff.py`, `public_drafting.py`; `tests/test_requirement_review.py`, `tests/test_public_drafting.py`.

- [x] Assign DAO contribution and lead-only requirements structurally, retaining whole-application readiness and legacy compatibility without a magic partner phrase.
- [x] Bind independent reviews to exact candidate/requirement/evidence, and gap-plan reviews to exact requirement/workspace/progress hashes. Review fixtures reject producer-as-reviewer and cross-plan admission.
- [ ] Enable `review_gap_plans=True` only when the authenticated reviewer adapter supports `kind="gap_plan"` and returns `ReviewedGapArtifact`. Missing capability leaves work agent-owned at `review_prepared_handoff`.
- [ ] Qualify host identity/authorization and semantic findings with selected live models. Human acceptance, commitments, signoff and submission remain separate.

## Task 4: Persist research and prepared handoffs

**State:** reviewed actionable-gap pipeline, awaiting publication. Reuse `WorkbenchAuditEvent`; no new research scheduler, parallel approval ledger or dedicated migration is required for this slice.

**Files:** `src/dfw_incentives/gap_actions.py`, `public_drafting.py`, existing artifact/rendering services; `tests/test_gap_actions.py`, `test_public_drafting.py`; `docs/actionable-funding-gaps.md`, `docs/public-drafting-continuation.md` in DFW.

**Contract:** `save_funding_gap_progress(workspace_hash, progress, previous_hash)` persists `GapProgress` for one source-bound requirement. Retain ordered attempts, evidence needs, relationship/contact sources, prepared work, next agent action and proposed decision owner separately from sponsor obligation owner. Exact review binds `GapPlanReview` to current progress. Prior attempts cannot be dropped; repeated delivery deduplicates and competing successors conflict.

- [x] Start partnership research with existing DAO affiliations/prior programs, then relevant local organizations. Save useful options with roles and exact public-contact evidence.
- [x] Save research and preparation using existing append-only audit receipts. Project only current, scoped public evidence; invalidate stale projections without erasing history.
- [x] Persist preparation into normal Markdown/DOCX output, including options, evidence needs, prepared work and next actions.
- [x] Independently review prepared handoffs. Rejected plans return a concrete agent step; a human request requires a precise remaining authority/access/private-record decision and no useful agent work remaining.
- [x] Verify actual scoped MCP save, SQLite persistence, restart/replay, checkpoint race, wrong-plan rejection, source changes and renderer persistence in focused tests.
- [ ] Publish and qualify the combined candidate. Exercise PostgreSQL concurrency and actual reviewer behavior in the selected host.
- [ ] Rehearse bounded research without confusing coverage limits with exhaustion. Six attempts trigger coverage review by default. Handoff requires independent plan review; host budgets remain configurable.

## Task 5: Portable skill and runtime qualification

**State:** PR40 merged, version 3.4.1. Exact remote CI 39999694731 passed all steps. Offline Codex marketplace installation and cache refresh are verified. Live model qualification remains pending.

**Files:** canonical `.agents/skills/dfw-funding-orchestrator/`, `plugins/dfw-funding-dfw/`, `scripts/install_plugin.py`, portable/native manifests, existing MCP server and packaging tests.

- [x] Preserve one canonical skill with validated packaged copies, native Claude/legacy Codex wrappers, `mcpServers`, MIT license and legacy tool aliases.
- [x] Default to skills-only installation without starting privileged operator MCP. Retain runtime receipt consistency checks and isolated stdio fixture calls. Authenticate live model traces through the selected host.
- [x] Verify Codex offline installation/cache update for 3.4.1.
- [ ] Exercise actual Codex, Claude and one named local tool-using runtime on identical frozen fixtures. Record unavailable runners as unexecuted.
- [ ] Verify Paperclip company skill import, per-agent assignment and actual tool execution. Qualify governed MCP authorization separately from direct runtime MCP. Members use only the scoped public factory. Restrict the privileged operator server to authorized operators.

## Task 6: Reusable DAO knowledge and financial snapshot contracts

**State:** implemented and independently approved locally under `dao-knowledge-v1`; unpublished and not live. Task 6 supplies source-backed SQL reuse and financial fixture normalization. Helix projection and retrieval remain planned.

**Files:** DFW `src/dfw_incentives/{organization_knowledge,financial_snapshots}.py`, existing applicant document/drafting/rendering services, `models.py`, migration 0014 and tests; Inertia `src/roundtable/knowledge.ts` and `test/roundtable/knowledge.test.ts`. Existing meeting ingestion/publication source files remain unchanged.

**Delivered contracts:** `propose_knowledge` creates exact-source candidates; `admit_knowledge` requires trusted semantic authority and expected revision; `select_knowledge` and permitted conflict reads enforce organization/audience/project/opportunity, source revision/hash and effective time. Existing applicant document versions/facts and WorkbenchAuditEvent retain evidence and history. Inertia `extractKnowledgeCandidates(Source, Notes)` requires a ready transcript and exact normalized-line excerpts, hashes raw source text and never grants adoption. `normalize_financial_snapshot` accepts one documented sanitized USD Profit & Loss fixture. Actual QuickBooks report/API compatibility requires provider qualification.

- [x] Cover duplicate minutes, corrections/negation, proposed/adopted distinctions, source revisions, conflicts, scope/admission and stale Markdown/DOCX output with red-before-green regressions.
- [x] Reuse scoped current public knowledge in drafting without widening opportunity/project restrictions or overwriting accepted decisions/history.
- [x] Preserve exact Decimal amounts and financial period/basis/currency/hash. Cash, grant budget and spending authority retain their separate evidence requirements.
- [x] Run 55 DFW knowledge and 118 financial tests; full DFW suite 624 passed with one missing-baseline-PPTX manifest failure. Ruff, strict mypy (102 files), compileall, build, locked audit and SQLite 0014 upgrade/downgrade/re-upgrade passed.
- [x] Run Inertia 50 new knowledge tests, 298/298 total, typecheck/build, clean production package and module smoke. Independent review approved both slices and ran 254 DFW focused/integration tests plus Inertia checks.
- [ ] Reapply reviewed patches to refreshed real repository heads, publish each slice separately and run complete-tree CI with the existing PPTX present.
- [ ] Qualify concurrent admission/source changes and schema/role isolation on disposable PostgreSQL. Configure the actual trusted importer and semantic admission policy; qualify the selected sanitized financial export and production adapter separately.

## Tasks 6A–6D: Core operational partner graph

These required implementation slices extend Task 6. Define failing fixtures in [T-K01–12](../../../testing.md#operational-partner-graph-acceptance-planned) and the funding graph matrix before implementing each slice. The graph must be useful in the October 30 demo; broader 990 and optional semantic/vector search follow later.

### 6A Source inventory and compatibility

- [x] Install official Helix TypeScript SDK 3.1.0 and embedded runtime 0.3.3; run a real embedded query.
- [ ] Pin Task 6 and the selected Helix deployment/API. Qualify conditional transaction/fencing semantics, indexes and writer readback; reuse an existing adapter if one becomes available.
- [ ] Inventory authorized website/meeting/existing partner sources, revisions, permissions and canonical member/project IDs. Seed DAO, TechFW/MADE, Moonshot, LiquidAcre and HackFW; map every relevant partner/contact/activity/owner or retain an explicit unresolved disposition.
- [ ] Define stable entity/alias bindings, identity resolution evidence and reversible merge/split behavior. Keep program/legal-entity, prospect/collaborator and planned/started/completed distinctions in fixtures.

### 6B Typed evidence and transactional research deltas

- [ ] Add a separately versioned typed assertion envelope alongside Task 6 evidence, binding exact identities, semantic value, qualifiers, scope and source revision/hash into trusted admission.
- [ ] Add predicate cardinality/validity-aware semantic conflict handling while preserving legacy exact-quote semantics and each source binding's restrictions.
- [ ] In one DAO PG transaction, commit permitted evidence, assertions/history and projection outbox. Add run/key/payload idempotency receipts, uniqueness/CAS, explicit no-change reasons and candidate/conflict dispositions.
- [ ] Verify rejected-opportunity writeback and later reuse, same-key changed-payload rejection, concurrent replay and no lost delta around PG commit. Keep organization-wide and project/opportunity scope distinct.

### 6C Helix projection and useful queries

- [ ] Implement stable projection keys, monotonic revisions, target-side lease-epoch fencing, atomic batch/receipt writes, lost-response reconciliation and tombstones. Qualify guards against the actual API before enabling takeover.
- [ ] Build scoped partner-by-capability, context and evidenced introduction queries; active secondary indexes start bounded traversals. Revalidate source/access/revision/freshness in PG before hydration. Add bounded indexed PG outage fallback and operator health.
- [ ] Connect scout/diligence to query first, research gaps only and return answer plus durable useful delta. Project useful new contacts/programs/capabilities from rejected opportunities without converting prospects to collaborators.

### 6D Backfill recovery and live qualification

- [ ] Backfill the complete bounded source inventory with durable coverage dispositions; overlap incremental refresh without gaps. Rebuild a fresh generation from a gap-safe committed high-water mark and reconcile identities/revisions before switch.
- [ ] Exercise outage/restart, duplicate/out-of-order writes, source correction/revocation, old-worker resume after deletion and access denial while the projector is stalled. No lost durable delta or resurrected tombstone is acceptable.
- [ ] Qualify real disposable PG concurrency/schema roles and pinned Helix transactions/indexes/deletion. Measure the documented performance targets; record actual results and any blocker.
- [ ] Rehearse known-partner reuse → useful research → durable delta → next-run indexed retrieval, including a rejected opportunity and an immediate revoked-contact denial. Verify every inventoried item has a stable mapping or explicit unresolved outcome.

## Task 7: Trusted native review application

**Files:** existing DFW `src/dfw_incentives/codex_agents.py`, `src/dfw_incentives/packet_handoff.py`, `src/dfw_incentives/models.py`; new `src/dfw_incentives/review_effects.py`, migration and `tests/test_review_effects.py`; Inertia new `src/grants/native-review.ts`, `test/grants/native-review.test.ts`; existing `src/grants/contracts.ts`.

**Interfaces:** DFW new `apply_review_effect(session: Session, decision: TrustedReviewDecision) -> ReviewEffectReceipt`. TrustedReviewDecision is constructed server-side, never accepted from member MCP: company/applicant, principal_id/type, domain_authorization_epoch, native_verification_time, interaction_id, item_id, target_kind/id/version/hash, workspace_hash, action, evidence_revisions. Receipt includes effect_key, result (`applied`, `replayed`, `stale`, `unauthorized`, `conflict`) and domain IDs. Inertia new `applyNativeGrantDecision(ref: NativeDecisionRef, deps: NativeReviewDependencies): Promise<ReviewEffectReceipt>` reads the authoritative native actor and result. NativeDecisionRef contains companyId, issueId, interactionId, itemId; dependencies are trusted native read and domain effect ports.

- [ ] Tests cover agent/system actor, wrong/revoked human role, partial card, defer, duplicate/reordered event, wrong company, changed document/packet/source, simultaneous accept/reject, and a source update racing the transaction.
- [ ] Run `uv run --locked pytest tests/test_review_effects.py tests/test_codex_agents.py -q` and `npm test -- test/grants/native-review.test.ts --maxWorkers=1`; confirm failures.
- [ ] Make the domain service authoritative for grant-review capabilities: an administrator-admitted organization/principal/scope grant with a monotonic authorization epoch, stored with domain data. Lock/recheck this grant and epoch in the same effect transaction; a role string from an event or agent is never authority. Native human identity and current membership are freshly read before application; timeout/unknown membership fails closed. Native membership and domain grants live in separate stores, with asynchronous native revocation propagation. Configure a short explicit verification-age limit, invalidate pending decisions when revocation is received, and require domain-grant revocation for immediate transactional denial. Deployment acceptance must choose and test that bound and revocation path.
- [ ] Move final revision validation and mutation into one domain transaction using locked revision rows or equivalent CAS. Record unique effect_key in the same transaction. Recheck the workspace inside that transaction. Native receipt retry reconciles saved effect.
- [ ] Preserve accepted/corrected/rejected proposal operations and packet changes_requested semantics. Preserve partner-only N/A and required role mapping. Native review never submits externally or infers a DAO vote.
- [ ] Run concurrency tests on real isolated PostgreSQL, full suites, commit `feat: apply authenticated native grant review safely`.

## Task 8: General objective intake and opportunity brief

**Files:** Inertia new `src/intake/contracts.ts`, `src/intake/service.ts`, `src/grants/brief.ts`, `test/intake/service.test.ts`, `test/grants/brief.test.ts`; existing `src/paperclip/adapter.ts`, `src/worker.ts`, `src/manifest.ts`; DFW new `src/dfw_incentives/opportunity_brief.py`, `src/dfw_incentives/objective_links.py`, model/migration and tests; extend the website integration proposal; production server rollout remains with its owner.

**Interfaces:** define `ObjectiveSubmission` in intake/contracts.ts: sourceId, revision, sourceHash, organizationId, authorRef, audience, title, text, withdrawn. `ingestObjective(input: ObjectiveSubmission, deps: IntakeDependencies): Promise<IntakeReceipt>` resolves trusted source authority and existing native mapping; receipt has status, sourceId, revision, nativeIssueId. Dependencies expose source readback, scoped native issue operations and durable mapping/reconciliation. Add trusted source ordering token or expectedPreviousHash, a unique mapping key (organization, source system, sourceId), and mapping-version CAS. Never lexically compare opaque revision strings. Serialize a pending create operation per key and reconcile unknown outcomes before any retry; if native lookup cannot establish presence/absence, remain pending. Apply only authoritative current revisions; retain a withdrawal tombstone. Audience narrowing suppresses derived output until native permissions converge; widening requires trusted source authority. `OpportunityBrief` is the spec's explicit presentation fields plus opportunity_id, project_ids, packet/version/hash, sources and gaps; DFW `build_opportunity_brief(context: dict[str, Any]) -> OpportunityBrief`; Inertia `renderOpportunityBrief(brief: OpportunityBrief): string` creates concise native-document Markdown.

**Durable funding links:** new domain `ObjectiveFundingLink` with organization_id, objective_source_system/id, opportunity_id, revision, fit_rationale, requirement_refs, proposed_contribution, packet_id/version/hash, status and provenance. Unique (organization, objective source/id, opportunity); links retain version history. `upsert_objective_funding_link(..., expected_revision)` owns updates in DFW; `list_funding_for_objective(...)` and `list_objectives_for_funding(...)` expose both directions with audience filtering. Paperclip owns task state, website owns submitted objective content, DFW owns funding/fit/link state. Buzz and website views call these owners and reconcile versioned projections.

- [ ] Tests: one submission delivered twice creates one issue; changed revision updates its linked issue; ambiguous creation reconciles without duplicate; withdrawal retains history; same text from two submitters stays attributable; hidden intake cannot appear in public output; revision 2 before 1, concurrent initial creates, audience narrowing and withdrawal racing an update cannot regress state. Test both funding-link lookup directions and conflicting link edits.
- [ ] Run `npm test -- test/intake/service.test.ts test/grants/brief.test.ts --maxWorkers=1` and `uv run --locked pytest tests/test_opportunity_brief.py -q`; confirm failures.
- [ ] Implement durable source/native identity mapping and explicit CEO intake assignment. Correlate retries using verified native primitives and reconciliation. Link multiple opportunities/projects without duplicating project state.
- [ ] Render the brief with separate application, delivery and reporting effort ranges and estimation basis; show evidence gaps and concrete meeting decisions. Native questions/documents/cards remain the review UI.
- [ ] Test meeting answer → scoped knowledge update → follow-up work → revised brief, then commit `feat: connect DAO objectives to funding preparation`.

## Task 9: Integration rehearsal and synchronized artifacts

- [ ] Run DFW full qualification on the dependency baseline, Inertia `npm test -- --maxWorkers=1`, `npm run typecheck`, `npm run build`, package verification and native-service integration.
- [ ] Rehearse one current public-only packet, independent critique, correction, native human decision, stale-source invalidation and repeated delivery. Run the same case across available actual runtimes.
- [ ] Rehearse one innovation submission and one meeting fixture; prove related work/funding links and query-first partner reuse. Persist useful deltas from an accepted and a rejected opportunity, then retrieve them during a second run.
- [ ] Record testing.md metrics and every unexecuted integration. Compare exact July originals when supplied through an authorized transfer. Continue current implementation in cloud.
- [ ] Update Inertia spec.md, testing.md, decisions.md, plan.md, HTML/Mermaid and editable deck together; add detailed DFW plan/tests to its repo. Preserve original PDF and existing artifact identities. Review and publish the synchronized set.

## Dependency order and stopping points

The CI, benchmark, candidate, route-review and portable-package foundations are merged. Publish and qualify the reviewed public drafting/gap continuation before host rehearsal. Independent v3 quality assessment and actual runtime qualification remain distinct from passing contract tests.

Task 6 evidence/SQL and sanitized financial contracts are independently approved local implementation awaiting publication and real PG/source qualification. Core partner graph/writeback slices 6A–6D are under implementation; tasks 7 (trusted native human effects) and 8 (general intake/brief) remain planned. Task 9 integrates proven slices. Use exact July archives for historical comparison; October discovery is a separate current-evidence track.

October discovery is published in draft PR42 on `discovery/2026-10-23-refresh`; CI is running and source qualification is in review. Inspect exact per-source results, admit only reviewed sources, run the authorized bounded scan and remove temporary CI before merge. The first DNS-failed scout, 33 manual findings and dated replay remain distinct; final scout success is pending.

External inputs: admitted source access, actual Helix compatibility, selected local runtime, actual human-role mapping, website server admission and production migration plan. Unfinished permitted research stays with agents. Ask people only for prepared, independently reviewed decisions or unavailable records/access. Keep artifacts synchronized as each status changes.
