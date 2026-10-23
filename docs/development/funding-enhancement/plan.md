# Funding enhancement implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax.

**Goal:** Deliver useful public-only applications, reusable DAO knowledge and a shared objective-to-funding workflow.
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

DFW paths below are relative to `government-funding-dfw/`; Inertia paths are repo-relative. Existing paths are verified in source-map.md; all other paths are explicitly **new**. Before editing, read repository instructions and refresh the selected base. Use separate feature branches/worktrees and small reviewed commits. Inertia feature branches target develop; DFW-Gov-Fund feature branches target main. Coordinate publication and expected-head merges; this plan does not change branch-protection or credential settings. Keep CI changes separate from drafting changes.

## Task 0: Restore the executable baseline

- [x] Reconcile the six vulnerable locked packages within compatible constraints. Review the actual lock diff, not only Dependabot titles.
- [x] Run locked audit, compile, Ruff, mypy, full pytest, build and SQLite migration smoke on the selected baseline. Record checks that cannot execute.
- [x] Use PR checks, the repository integration-branch pushes and manual dispatch; cancel superseded runs per PR/ref. Keep essential checks. Avoid path filters until their required-check behavior is proven.
- [x] Review and commit this separately. Current evidence shows duplicated push/PR runs, not an account-quota cause for the inspected audit failures.

Current status: PR35 targets DFW main; exact-head run 39987898544 passed full checks. Merged into main at `ac483c309d1df84dec8a8106ec5f13860e080fc0`. Task 1 is in progress; no enhancement-quality results are measured.

Tasks 1 and design-only source capture can proceed in parallel. Qualification of changed runtime requires task 0's resolved baseline.

## Task 1: Freeze measurable public-only cases

**Files:** new `tests/fixtures/funding_quality/{cases.json,evidence.json,expected.json}`; new `src/dfw_incentives/quality_benchmark.py`; new `tests/test_funding_quality_benchmark.py`.

**Interfaces:** new `evaluate_case(case: BenchmarkCase, packet: dict[str, Any], review: dict[str, Any]) -> BenchmarkResult`. Define Pydantic `BenchmarkCase` and `BenchmarkResult` in that module. Case fields: id, track, as_of, route, source_refs, requirements, expected_claims, prohibited_claims, expected_gap_owners. Result fields: eligible_fields, useful_fields, supported_claims, unsupported_claims, avoidable_human_requests, route_errors, elapsed_seconds, cost_usd (nullable when unavailable). Track is `public_current`, `historical_exact`, or `synthetic_contract`. The evaluator calculates deterministic checks separately from independently supplied semantic assessments; use testing.md's frozen rubric and adjudication schema. Neither producer flags nor generic automated judgment determine the gold answerable-field set. Closed current cases remain historical/next-cycle exercises, not eligible live leads.

- [ ] Write tests asserting future-dated evidence is excluded from `historical_exact`, missing archived inputs prevent historical evaluation, and synthetic/current results cannot be labeled historical improvement.
- [ ] Run `uv run --locked pytest tests/test_funding_quality_benchmark.py -q`; new behavior must fail first.
- [ ] Implement cases for CDBG, RAMPS, CyberAICorps, TechAccess and SDF using source-backed current inputs. Preserve closed/next-cycle/partner route. Use audited July counts as contextual baseline only until exact original packets are supplied.
- [ ] Run the tests and generate a machine-readable baseline report. Review expected field classifications independently before measuring model output.
- [ ] Commit `test: add source-backed funding quality fixtures`.

## Task 2: Produce useful, scoped draft candidates

**Files:** existing `src/dfw_incentives/agents/drafting.py`, `src/dfw_incentives/codex_agents.py`, `src/dfw_incentives/models.py`; new `src/dfw_incentives/draft_candidates.py`; new Alembic revision under existing `alembic/versions/` convention after verifying current migration head; new `tests/test_draft_candidates.py`; existing `tests/test_grounded_drafting.py`, `tests/test_codex_agents.py`.

**Interfaces:** new `DraftCandidate` model and `build_candidate(workspace: CodexWorkspace, proposal: CodexProposalInput, claim_support: list[ClaimSupport]) -> DraftCandidate`. Define `ClaimSupport` in draft_candidates.py: claim_text, evidence_id, source_locator, source_revision, support_kind (`fact`, `attributed`, `proposal_basis`), source_content_hash, claim_start/end offsets into the exact candidate value, and optional numeric_derivation (operands with source references, formula, units). Candidate has requirement_id/revision/hash, candidate_hash, workspace_hash, target_type/key, value, claim_support, answer_kind and gap_codes. Producer input has no reviewer verdict. A separate `CandidateReview` records authenticated reviewer/run identity, rubric version, candidate hash, requirement hash, evidence-set hash and findings; trusted orchestration derives machine_review_state from this artifact. Any changed binding invalidates review. `render_candidate_context(candidates: list[DraftCandidate]) -> dict[str, Any]` supplies a separate candidate section to the existing renderer; it never calls `_apply_answer` or changes accepted applicant fields.

- [ ] Add tests: observed repository evidence supports an attributed capability; self-description is attributed; unsupported staffing/outcomes fail review; proposed work remains future-tense; unrelated citation fails semantic-review fixture; changed source/audience excludes candidate.
- [ ] Run `uv run --locked pytest tests/test_draft_candidates.py tests/test_grounded_drafting.py tests/test_codex_agents.py -q` and confirm intended failures.
- [ ] Implement candidate rendering without changing human acceptance semantics. Fix capacity selection to use explicit evidence categories/attribution rather than the current prefix-only verified filter. Bound value size and use existing allowed targets/evidence IDs.
- [ ] Extend numeric support validation: amount/rate/period/currency/commitment evidence must match the value. Derived request/match values record operands and formula. Add tests that award ceiling is not silently request, sponsor notice is not applicant financial evidence, and an unrelated approved document cannot support a salary rate.
- [ ] Run focused tests plus benchmark and commit `feat: render evidence-backed funding draft candidates`.

## Task 3: Route-aware completeness and independent review

**Files:** existing `src/dfw_incentives/agents/review.py`, `src/dfw_incentives/agents/drafting.py`, `src/dfw_incentives/packet_handoff.py`; new `src/dfw_incentives/requirement_review.py`; new `tests/test_requirement_review.py`; existing `tests/test_draft_review.py`, `tests/test_phase2_agents.py`.

**Interfaces:** new `review_requirements(requirements: list[dict[str, Any]], candidates: list[DraftCandidate], submission_mode: str) -> RequirementReview`. Define RequirementReview fields: rows (requirement_id, owner_role, candidate_state, support_state, gaps), ready_for_meeting, ready_for_human_signoff, blocking_requirement_ids. These are derived assessments, not new workflow states.

- [ ] Tests assert partner capability/work-package requirements belong to DAO; lead certifications remain lead-owned; whole-application readiness still reports missing lead forms. Semantically equivalent text passes without a mandatory magic phrase.
- [ ] Run `uv run --locked pytest tests/test_requirement_review.py tests/test_draft_review.py tests/test_phase2_agents.py -q`; confirm failures.
- [ ] Replace literal partner-phrase validation with structured route/ownership checks. Keep legacy text API compatible while passing structured review from the packet path.
- [ ] Add independent reviewer instructions using frozen requirements/evidence/candidate hashes. Record requirement-level findings; scope each repair to findings, with configurable two-rework default. Reviewer cannot change applicant facts or grant human approval.
- [ ] Run tests, include reviewer disagreement and repeated-defect escalation, commit `fix: assess grant completeness by route and evidence`.

## Task 4: Persist research progress and useful stopping reasons

**Files:** existing `src/dfw_incentives/coverage.py`, `src/dfw_incentives/source_operations.py`, `src/dfw_incentives/agents/orchestrator.py`, `src/dfw_incentives/models.py`; new `src/dfw_incentives/research_progress.py`; new migration; new `tests/test_research_progress.py`; existing `tests/test_source_operations.py`.

**Interfaces:** new `record_research_attempt(session: Session, attempt: ResearchAttempt) -> str`; `summarize_research(attempts: list[ResearchAttempt]) -> ResearchSummary`. Define dataclasses in research_progress.py. Attempt includes organization, case, source/query, cursor/page range, retrieved_at, input/source hash, result count, limitation, next action. Summary includes coverage_state, unresolved_questions, next_sources, stop_reason and retry_after. Allowed stop reasons: satisfied, access_blocked, unavailable, bounded_coverage, budget_exhausted, no_eligible_result.

- [ ] Tests: zero records with max_pages=1 produces bounded coverage; forbidden source remains access blocked; retries preserve prior evidence; unchanged source is not repeatedly re-decided; newly available evidence reopens affected question only.
- [ ] Run `uv run --locked pytest tests/test_research_progress.py tests/test_source_operations.py -q`; confirm failures.
- [ ] Implement checkpoint persistence and expose it through existing cycle/report paths. Leave scheduling to Paperclip when it owns the workflow; retain standalone operation compatibility.
- [ ] Test restart and concurrent duplicate attempts, run focused tests, commit `feat: retain grant research coverage and continuation`.

## Task 5: Portable skill and runtime qualification

**Files:** existing `.agents/skills/dfw-funding-orchestrator/`, `plugins/dfw-funding-dfw/`, `scripts/install_plugin.py`, `src/dfw_incentives/mcp_server.py`, `tests/test_portable_distribution.py`; new plugin-root `plugin.json`, `mcp.json`, `.claude-plugin/plugin.json`; new `scripts/verify_runtime_contract.py`.

**Interfaces:** add neutral MCP aliases `funding_drafting_workspace` and `save_funding_proposals` with the same signatures/returns as existing Codex tools. Preserve legacy names and DB model/table names. New verifier consumes a JSON runtime receipt: runtime, version, skill_hash, tool_schema_hash, input_hash, proposal_hash, observed_tool_calls, forbidden_side_effects.

- [ ] Add packaging tests: canonical skill equals packaged skill; all internal paths resolve; metadata license agrees with repository license; portable and Claude manifests validate; no secrets/broad DB credentials in generated config; both tool names produce equivalent output.
- [ ] Run `uv run --locked pytest tests/test_portable_distribution.py tests/test_codex_agents.py -q`; confirm new assertions fail.
- [ ] Add thin wrappers and runtime-neutral labels without duplicating engine behavior. A member-facing launch connects only to scoped proposal/read tools, not the current privileged local MCP against a shared DB.
- [ ] Exercise actual Codex, Claude Code and one selected local tool-using runtime on identical frozen fixtures. Verify skill delivery and tool invocation, not only manifest import. Record unavailable runners as unexecuted, never passed.
- [ ] Verify native Paperclip company import and per-agent skill enablement on the selected release. Qualify governed MCP gateway separately from direct runtime MCP. Commit `feat: package funding skills for portable agent runtimes`.

## Task 6: Reusable DAO knowledge and financial snapshot contracts

**Files:** existing DFW `src/dfw_incentives/models.py`, `src/dfw_incentives/applicant_documents.py`, `src/dfw_incentives/codex_agents.py`; new `src/dfw_incentives/organization_knowledge.py`, `src/dfw_incentives/financial_snapshots.py`, migrations and tests; Inertia new `src/roundtable/knowledge.ts`, `test/roundtable/knowledge.test.ts` alongside existing ingestion/website modules.

**Interfaces:** new Python `select_knowledge(session: Session, query: KnowledgeQuery) -> list[KnowledgeRecord]`; `propose_knowledge(session: Session, record: KnowledgeRecord) -> str`. Define both types in organization_knowledge.py using spec record fields. Query includes organization, permitted_audiences, project/opportunity, as_of and principal scope supplied by trusted service. New `normalize_financial_snapshot(raw: dict[str, Any], source: FinancialSource) -> FinancialSnapshot` accepts only a documented report fixture format in the initial slice; FinancialSource includes company, reference, period, basis, currency, retrieved_at and hash. Inertia new `extractKnowledgeCandidates(source: Source, notes: Notes): KnowledgeCandidate[]` preserves source locators and candidate status; it does not adopt decisions. Import `Source` and `Notes` as types from existing `./ingestion.js`; Source has meetingId/sourceId/revision/ready/kind/audience/text and Notes holds exact 1-based line excerpts. Hash raw Source.text using existing `sha256` from `./codec.js`; bind locators to the normalized transcript used by ingestion. Require transcript kind and ready source, validate excerpts against that normalized text, and reject summary-only or mismatched line inputs.

- [ ] Tests cover repeated minutes, corrections, negation, proposed versus adopted decisions, revoked facts, conflicting values, opportunity-scoped budget reuse rejection, cross-audience filtering, changed source invalidation and currency/accounting-basis mismatch.
- [ ] Run `uv run --locked pytest tests/test_organization_knowledge.py tests/test_financial_snapshots.py -q` and `npm test -- test/roundtable/knowledge.test.ts --maxWorkers=1`; confirm intended failures.
- [ ] Force `propose_knowledge` status to candidate regardless of producer input. Add `admit_knowledge(session, record_id, expected_revision, decision: TrustedKnowledgeAdmission)`: trusted source-admission policy may admit attributable factual observations; an authorized human or authoritative adopted-decision record must establish priorities, commitments and adopted decisions. Admission records actor/policy, evidence hash, scope and effective dates. Revoke/supersede through versioned trusted effects, never extraction. Reject producer-assigned current status and unauthorized scope widening.
- [ ] Implement provenance/selection and reuse existing evidence/document records. Keep meeting publication behavior unchanged. Normalize a sanitized QuickBooks-style report fixture; production adapter and actual API shape are qualified only after source access is chosen.
- [ ] Run migration tests on SQLite and isolated PostgreSQL, with schema/role isolation. DAO production migration remains an admitted deployment step. Commit separately in each repo with matching contract revision.

## Task 7: Trusted native review application

**Files:** existing DFW `src/dfw_incentives/codex_agents.py`, `src/dfw_incentives/packet_handoff.py`, `src/dfw_incentives/models.py`; new `src/dfw_incentives/review_effects.py`, migration and `tests/test_review_effects.py`; Inertia new `src/grants/native-review.ts`, `test/grants/native-review.test.ts`; existing `src/grants/contracts.ts`.

**Interfaces:** DFW new `apply_review_effect(session: Session, decision: TrustedReviewDecision) -> ReviewEffectReceipt`. TrustedReviewDecision is constructed server-side, never accepted from member MCP: company/applicant, principal_id/type, domain_authorization_epoch, native_verification_time, interaction_id, item_id, target_kind/id/version/hash, workspace_hash, action, evidence_revisions. Receipt includes effect_key, result (`applied`, `replayed`, `stale`, `unauthorized`, `conflict`) and domain IDs. Inertia new `applyNativeGrantDecision(ref: NativeDecisionRef, deps: NativeReviewDependencies): Promise<ReviewEffectReceipt>` reads authoritative native actor/result, not supplied narration. NativeDecisionRef contains companyId, issueId, interactionId, itemId; dependencies are trusted native read and domain effect ports.

- [ ] Tests cover agent/system actor, wrong/revoked human role, partial card, defer, duplicate/reordered event, wrong company, changed document/packet/source, simultaneous accept/reject, and a source update racing the transaction.
- [ ] Run `uv run --locked pytest tests/test_review_effects.py tests/test_codex_agents.py -q` and `npm test -- test/grants/native-review.test.ts --maxWorkers=1`; confirm failures.
- [ ] Make the domain service authoritative for grant-review capabilities: an administrator-admitted organization/principal/scope grant with a monotonic authorization epoch, stored with domain data. Lock/recheck this grant and epoch in the same effect transaction; a role string from an event or agent is never authority. Native human identity and current membership are freshly read before application; timeout/unknown membership fails closed. Native membership and domain grants are separate stores: native revocation propagation is not atomic. Configure a short explicit verification-age limit, invalidate pending decisions when revocation is received, and require domain-grant revocation for immediate transactional denial. Deployment acceptance must choose and test that bound and revocation path.
- [ ] Move final revision validation and mutation into one domain transaction using locked revision rows or equivalent CAS. Record unique effect_key in the same transaction. Do not treat existing preflight workspace check as atomic. Native receipt retry reconciles saved effect.
- [ ] Preserve accepted/corrected/rejected proposal operations and packet changes_requested semantics. Preserve partner-only N/A and required role mapping. Native review never submits externally or infers a DAO vote.
- [ ] Run concurrency tests on real isolated PostgreSQL, full suites, commit `feat: apply authenticated native grant review safely`.

## Task 8: General objective intake and opportunity brief

**Files:** Inertia new `src/intake/contracts.ts`, `src/intake/service.ts`, `src/grants/brief.ts`, `test/intake/service.test.ts`, `test/grants/brief.test.ts`; existing `src/paperclip/adapter.ts`, `src/worker.ts`, `src/manifest.ts`; DFW new `src/dfw_incentives/opportunity_brief.py`, `src/dfw_incentives/objective_links.py`, model/migration and tests; extend website integration proposal, not the website production server.

**Interfaces:** define `ObjectiveSubmission` in intake/contracts.ts: sourceId, revision, sourceHash, organizationId, authorRef, audience, title, text, withdrawn. `ingestObjective(input: ObjectiveSubmission, deps: IntakeDependencies): Promise<IntakeReceipt>` resolves trusted source authority and existing native mapping; receipt has status, sourceId, revision, nativeIssueId. Dependencies expose source readback, scoped native issue operations and durable mapping/reconciliation. Add trusted source ordering token or expectedPreviousHash, a unique mapping key (organization, source system, sourceId), and mapping-version CAS. Never lexically compare opaque revision strings. Serialize a pending create operation per key and reconcile unknown outcomes before any retry; if native lookup cannot establish presence/absence, remain pending. Apply only authoritative current revisions; retain a withdrawal tombstone. Audience narrowing suppresses derived output until native permissions converge; widening requires trusted source authority, not submitted text. `OpportunityBrief` is the spec's explicit presentation fields plus opportunity_id, project_ids, packet/version/hash, sources and gaps; DFW `build_opportunity_brief(context: dict[str, Any]) -> OpportunityBrief`; Inertia `renderOpportunityBrief(brief: OpportunityBrief): string` creates concise native-document Markdown.

**Durable funding links:** new domain `ObjectiveFundingLink` with organization_id, objective_source_system/id, opportunity_id, revision, fit_rationale, requirement_refs, proposed_contribution, packet_id/version/hash, status and provenance. Unique (organization, objective source/id, opportunity); links retain version history. `upsert_objective_funding_link(..., expected_revision)` owns updates in DFW; `list_funding_for_objective(...)` and `list_objectives_for_funding(...)` expose both directions with audience filtering. Paperclip owns task state, website owns submitted objective content, DFW owns funding/fit/link state. Buzz and website views call these owners and reconcile versioned projections rather than independently editing copied state.

- [ ] Tests: one submission delivered twice creates one issue; changed revision updates its linked issue; ambiguous creation reconciles without duplicate; withdrawal retains history; same text from two submitters stays attributable; hidden intake cannot appear in public output; revision 2 before 1, concurrent initial creates, audience narrowing and withdrawal racing an update cannot regress state. Test both funding-link lookup directions and conflicting link edits.
- [ ] Run `npm test -- test/intake/service.test.ts test/grants/brief.test.ts --maxWorkers=1` and `uv run --locked pytest tests/test_opportunity_brief.py -q`; confirm failures.
- [ ] Implement durable source/native identity mapping and explicit CEO intake assignment. Correlate retries using existing native primitives and reconciliation, not a generic assumed wake idempotency key. Link multiple opportunities/projects without duplicating project state.
- [ ] Render the brief with separate application, delivery and reporting effort ranges and estimation basis; show evidence gaps and concrete meeting decisions. Native questions/documents/cards remain the review UI.
- [ ] Test meeting answer → scoped knowledge update → follow-up work → revised brief, then commit `feat: connect DAO objectives to funding preparation`.

## Task 9: Integration rehearsal and synchronized artifacts

- [ ] Run DFW full qualification on the dependency baseline, Inertia `npm test -- --maxWorkers=1`, `npm run typecheck`, `npm run build`, package verification and native-service integration.
- [ ] Rehearse one current public-only packet, independent critique, correction, native human decision, stale-source invalidation and repeated delivery. Run the same case across available actual runtimes.
- [ ] Rehearse one innovation submission and one meeting fixture; prove related work/funding links and reusable knowledge with a second opportunity.
- [ ] Record testing.md metrics and every unexecuted integration. Compare exact July originals only when supplied through an authorized transfer; do not reopen laptop work merely to unblock current implementation.
- [ ] Update Inertia spec.md, testing.md, decisions.md, plan.md, HTML/Mermaid and editable deck together; add detailed DFW plan/tests to its repo. Preserve original PDF and existing artifact identities. Review and publish the synchronized set.

## Dependency order and stopping points

1 → 2 → 3 establishes quality. Task 4 can run alongside 2; task 5 follows stable proposal contracts. Task 6 establishes reusable context; task 7 requires stable revision/authorization contracts; task 8 uses those records and native mappings. Task 9 integrates the proven slices. CI baseline is parallel and gates qualification, not source investigation.

Unblocked now: source-backed fixtures, deterministic quality contracts, draft/review fixes, portable packaging, simulated adapters and native integration tests. Later external inputs: exact archived beta transfer for historical replay, named local runtime, source credentials/access, authorized role mapping, website server admission and production data migration plan. None requires speculative secrets or a new account to begin.
