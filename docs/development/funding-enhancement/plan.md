# Funding enhancement implementation plan

Revision: FUNDING-2026-10-24-r6.
Updated: 2026-10-24 (UTC)

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

Historical baseline: PR35 merged at `ac483c309d1df84dec8a8106ec5f13860e080fc0`; exact-head run 39987898544 passed. Subsequent merged work is included in version 3.4.1 main `c615525291a656f9abd4da1262c23fa8ae97290c`, qualified by run 39999694731.

## Task 1: Freeze measurable public-only cases

**State:** benchmark implementation merged in PR37. Five public cases cover eight captured requirements. Sponsor inventories remain partial and independent gold admission is pending. The merged actionable-gap implementation supplies rubric v3. Next, reassess the five examples against its preparation and handoff criteria.

**Files:** `src/dfw_incentives/quality_benchmark.py`, `tests/test_funding_quality_benchmark.py`, `tests/fixtures/funding_quality/`.

- [x] Implement immutable fixture/candidate/evidence bindings, fixed captured denominators, deterministic checks separated from semantic assessments, independent votes and adjudication records.
- [x] Keep current public, synthetic and exact historical tracks separate; reject historical claims without archived inputs.
- [ ] Complete sponsor inventories, admit gold independently and reassess actual outputs under v3 preparation/action-support/decision-precision criteria.
- [ ] Run `uv run --locked pytest tests/test_funding_quality_benchmark.py -q`; retain field scores, reviewer versions, disagreements, cost and elapsed time for live comparisons.

## Task 2: Produce useful, scoped draft candidates

**State:** candidate/review rendering, scoped public drafting, independent review, targeted repair and durable continuation are merged. Qualify actual host/model behavior next.

**Files:** `src/dfw_incentives/{draft_candidates,codex_agents,public_drafting}.py`, existing drafting/artifact services; `tests/test_draft_candidates.py`, `tests/test_public_drafting.py` and regression suites.

- [x] Bind candidate claims to exact requirements and source spans; render them separately from accepted applicant facts and retain numeric evidence validation.
- [x] Review the scoped `PublicDraftingService`/`create_public_funding_mcp` bridge. Host-owned identities and public-source admission exclude private fields, credentials and signoff tools. Save unaccepted suggestions; freeze review inputs; allow at most two targeted repairs.
- [x] Verify checkpointed suggestions/reviews/repairs, interruption recovery, replay deduplication and current-source rejection with controlled trusted adapters.
- [x] Merge the reviewed public drafting candidate with its complete-tree checks.
- [ ] Configure actual host reviewer/repair adapters and evaluate live semantic quality.
- [ ] Preserve `tests/test_grounded_drafting.py`, `tests/test_codex_agents.py` and actual Markdown/DOCX rendering checks.

## Task 3: Route-aware completeness and independent review

**State:** structured route/ownership assessment merged in PR39. The merged bridge supports trusted independent candidate and source-bound gap-plan review.

**Files:** `src/dfw_incentives/requirement_review.py`, existing `agents/review.py`, `packet_handoff.py`, `public_drafting.py`; `tests/test_requirement_review.py`, `tests/test_public_drafting.py`.

- [x] Assign DAO contribution and lead-only requirements structurally, retaining whole-application readiness and legacy compatibility without a magic partner phrase.
- [x] Bind independent reviews to exact candidate/requirement/evidence, and gap-plan reviews to exact requirement/workspace/progress hashes. Review fixtures reject producer-as-reviewer and cross-plan admission.
- [ ] Enable `review_gap_plans=True` only when the authenticated reviewer adapter supports `kind="gap_plan"` and returns `ReviewedGapArtifact`. Missing capability leaves work agent-owned at `review_prepared_handoff`.
- [ ] Qualify host identity/authorization and semantic findings with selected live models. Human acceptance, commitments, signoff and submission remain separate.

## Task 4: Persist research and prepared handoffs

**State:** actionable-gap pipeline merged and independently reviewed. Reuse `WorkbenchAuditEvent`; no new research scheduler, parallel approval ledger or dedicated migration is required for this slice.

**Files:** `src/dfw_incentives/gap_actions.py`, `public_drafting.py`, existing artifact/rendering services; `tests/test_gap_actions.py`, `test_public_drafting.py`; `docs/actionable-funding-gaps.md`, `docs/public-drafting-continuation.md` in DFW.

**Contract:** `save_funding_gap_progress(workspace_hash, progress, previous_hash)` persists `GapProgress` for one source-bound requirement. Retain ordered attempts, evidence needs, relationship/contact sources, prepared work, next agent action and proposed decision owner separately from sponsor obligation owner. Exact review binds `GapPlanReview` to current progress. Prior attempts cannot be dropped; repeated delivery deduplicates and competing successors conflict.

- [x] Start partnership research with existing DAO affiliations/prior programs, then relevant local organizations. Save useful options with roles and exact public-contact evidence.
- [x] Save research and preparation using existing append-only audit receipts. Project only current, scoped public evidence; invalidate stale projections without erasing history.
- [x] Persist preparation into normal Markdown/DOCX output, including options, evidence needs, prepared work and next actions.
- [x] Independently review prepared handoffs. Rejected plans return a concrete agent step; a human request requires a precise remaining authority/access/private-record decision and no useful agent work remaining.
- [x] Verify actual scoped MCP save, SQLite persistence, restart/replay, checkpoint race, wrong-plan rejection, source changes and renderer persistence in focused tests.
- [x] Merge the combined candidate and pass real disposable PostgreSQL domain qualification.
- [ ] Qualify actual reviewer behavior in the selected host.
- [ ] Rehearse bounded research without confusing coverage limits with exhaustion. Six attempts trigger coverage review by default. Handoff requires independent plan review; host budgets remain configurable.

## Task 5: Portable skill and runtime qualification

Operational discovery extension: assign one native research agent authorized objectives, search/browser tools, source access and a bounded query/page/time/cost budget. Verify actual tool execution against an unseeded official opportunity and a near-deadline case. The portable discovery/meeting supplement is merged in Inertia PR29; the daily schedule remains disabled.

**State:** PR40 merged, version 3.4.1. Exact remote CI 39999694731 passed all steps. Offline Codex marketplace installation and cache refresh are verified. Live model qualification remains pending.

**Files:** canonical `.agents/skills/dfw-funding-orchestrator/`, `plugins/dfw-funding-dfw/`, `scripts/install_plugin.py`, portable/native manifests, existing MCP server and packaging tests.

- [x] Preserve one canonical skill with validated packaged copies, native Claude/legacy Codex wrappers, `mcpServers`, MIT license and legacy tool aliases.
- [x] Default to skills-only installation without starting privileged operator MCP. Retain runtime receipt consistency checks and isolated stdio fixture calls. Authenticate live model traces through the selected host.
- [x] Verify Codex offline installation/cache update for 3.4.1.
- [ ] Exercise actual Codex, Claude and one named local tool-using runtime on identical frozen fixtures. Record unavailable runners as unexecuted.
- [ ] Verify Paperclip company skill import, per-agent assignment and actual tool execution. Qualify governed MCP authorization separately from direct runtime MCP. Members use only the scoped public factory. Restrict the privileged operator server to authorized operators.

## Task 6: Reusable DAO knowledge and financial snapshot contracts

**State:** Task 6 and the Helix projection/retrieval core are merged. Real disposable PostgreSQL domain and PG-to-embedded-Helix rehearsal passed independently. Production source/importer, role and financial-adapter activation remain pending.

**Files:** DFW `src/dfw_incentives/{organization_knowledge,financial_snapshots}.py`, existing applicant document/drafting/rendering services, `models.py`, migration 0014 and tests; Inertia `src/roundtable/knowledge.ts` and `test/roundtable/knowledge.test.ts`. Existing meeting ingestion/publication source files remain unchanged.

**Delivered contracts:** `propose_knowledge` creates exact-source candidates; `admit_knowledge` requires trusted semantic authority and expected revision; `select_knowledge` and permitted conflict reads enforce organization/audience/project/opportunity, source revision/hash and effective time. Existing applicant document versions/facts and WorkbenchAuditEvent retain evidence and history. Inertia `extractKnowledgeCandidates(Source, Notes)` requires a ready transcript and exact normalized-line excerpts, hashes raw source text and never grants adoption. `normalize_financial_snapshot` accepts one documented sanitized USD Profit & Loss fixture. Actual QuickBooks report/API compatibility requires provider qualification.

- [x] Cover duplicate minutes, corrections/negation, proposed/adopted distinctions, source revisions, conflicts, scope/admission and stale Markdown/DOCX output with red-before-green regressions.
- [x] Reuse scoped current public knowledge in drafting without widening opportunity/project restrictions or overwriting accepted decisions/history.
- [x] Preserve exact Decimal amounts and financial period/basis/currency/hash. Cash, grant budget and spending authority retain their separate evidence requirements.
- [x] Run 55 DFW knowledge and 118 financial tests; full DFW suite 624 passed with one missing-baseline-PPTX manifest failure. Ruff, strict mypy (102 files), compileall, build, locked audit and SQLite 0014 upgrade/downgrade/re-upgrade passed.
- [x] Run Inertia 50 new knowledge tests, 298/298 total, typecheck/build, clean production package and module smoke. Independent review approved both slices and ran 254 DFW focused/integration tests plus Inertia checks.
- [x] Integrate and merge the reviewed Task 6 repository slices; retain complete-tree and historical qualification receipts.
- [x] Qualify domain behavior on real disposable PostgreSQL/PostGIS through the cloud rehearsal.
- [ ] Configure production roles, trusted importer and semantic admission policy; qualify the selected financial export and production adapter.

## Tasks 6A–6D: Core operational partner graph

These required slices extend merged Task 6. The graph core is merged, and independent cloud rehearsal passed real PostgreSQL/PostGIS domain, native PostgreSQL and PG-to-embedded-Helix lanes. Production source/host/service adapters, admitted inventory/backfill and live acceptance remain pending. Checked items record completed implementation and bounded qualification; open items retain [T-K01–12](../../../testing.md#operational-partner-graph-acceptance-live-qualification-pending). Broader 990 and optional semantic/vector search follow later.

### 6A Source inventory and compatibility

- [x] Install official Helix TypeScript SDK 3.1.0 and embedded runtime 0.3.3; run a real embedded query.
- [ ] Pin Task 6 and the selected Helix deployment/API. Qualify conditional transaction/fencing semantics, indexes and writer readback; reuse an existing adapter if one becomes available.
- [ ] Inventory authorized website/meeting/existing partner sources, revisions, permissions and canonical member/project IDs. Seed DAO, TechFW/MADE, Moonshot, LiquidAcre and HackFW; map every relevant partner/contact/activity/owner or retain an explicit unresolved disposition.
- [x] Implement stable entity/alias bindings and identity-resolution evidence, preserving program/legal-entity, prospect/collaborator and activity-stage distinctions in local fixtures.
- [ ] Qualify the actual inventory and reversible merge/split workflow before admitting source identities.

### 6B Typed evidence and transactional research deltas

- [x] Add a separately versioned typed assertion envelope alongside Task 6 evidence, binding exact identities, semantic value, qualifiers, scope and source revision/hash into trusted admission.
- [x] Add predicate cardinality/validity-aware semantic conflict handling while preserving legacy exact-quote semantics and each source binding's restrictions.
- [x] Implement one SQL transaction for permitted evidence, assertions/history and projection outbox, with run/key/payload idempotency receipts, uniqueness/CAS, explicit no-change reasons and candidate/conflict dispositions. Real disposable PostgreSQL qualification passed; production writer composition remains open.
- [x] Verify rejected-opportunity writeback and later reuse, changed-payload rejection, replay and atomic local SQL persistence. Keep organization-wide and project/opportunity scope distinct; retain the real PostgreSQL cloud receipt and qualify production writer composition separately.

### 6C Helix projection and useful queries

Operational discovery extension: connect due-source rechecks and open-ended coverage-gap search to official evidence capture, existing candidate/enrichment services and trusted research-delta persistence. Keep reusable source-adapter admission separate from validating a useful candidate. See [discovery-loop.md](discovery-loop.md).

- [x] Implement and locally verify stable projection keys, monotonic revisions, target-side lease-epoch fencing, atomic batch/receipt writes, lost-response reconciliation and tombstones against the actual embedded Helix API. Deployed service qualification remains open.
- [x] Build scoped partner-by-capability, context and evidenced introduction queries, active indexes, authoritative source/access/revision/freshness revalidation, bounded indexed SQL fallback and operator health. Bind these local modules to authenticated production sources before live use.
- [x] Implement the query-first research contract and durable useful-delta/no-change receipts; the local rehearsal retains rejected-opportunity knowledge without converting prospects to collaborators.
- [ ] Connect actual scout/diligence services through authenticated source ports and qualify the complete live workflow.

### 6D Backfill recovery and live qualification

Operational discovery extension: prove restart/uncertain-delivery recovery, changed deadlines, source failure, bounded coverage, useful rejected-opportunity writeback and next-run reuse. Measure detection-to-alert latency and missed cases on a declared set; retain unresolved coverage as durable native work.

- [ ] Backfill the complete bounded source inventory with durable coverage dispositions; overlap incremental refresh without gaps. Rebuild a fresh generation from a gap-safe committed high-water mark and reconcile identities/revisions before switch.
- [x] Exercise core outage/replay, source correction/revocation, stale-worker denial and tombstone protection in local tests and actual embedded Helix/Python rehearsal.
- [ ] Qualify deployed multi-process failover and recovery. No lost durable delta or resurrected tombstone is acceptable.
- [x] Pass independent real PostgreSQL/PostGIS domain, native PG18 and PG-to-embedded-Helix cloud rehearsal.
- [ ] Qualify production roles, deployed Helix transactions/indexes/deletion and representative performance targets.
- [ ] Rehearse known-partner reuse → useful research → durable delta → next-run indexed retrieval, including a rejected opportunity and an immediate revoked-contact denial. Verify every inventoried item has a stable mapping or explicit unresolved outcome.

## Task 7: Trusted native review application

**State:** The independently reviewed durable core is merged in DFW PR50 and Inertia host PR31. The durable successor captures authority for one exact command/version atomically with the native verdict. Later native role/membership changes, document edits, card withdrawal or disconnect do not revoke that instruction. Explicit cancellation takes effect only when DFW confirms it; an already-applied effect is not undone. Current DFW authorization, evidence, head and artifact checks still block stale effects, and submission authority remains separate. The core is implemented and independently reviewed; production route/transport, lifecycle-compatible retention/archive, real role/binding/source access, qualified writer fencing and a human correction/cancel walkthrough remain activation gates. The legacy adapter stays default-disabled. The checklist retains legacy requirements and records the completed successor core separately.

**Files:** durable DFW `src/dfw_incentives/durable_native_review.py`, `tests/test_durable_native_review.py` and `qualification/run-durable-native-review-postgres.sh`; Inertia `host-composition/paperclip-durable-funding-review/`; existing DFW `src/dfw_incentives/codex_agents.py`, `src/dfw_incentives/packet_handoff.py`, `src/dfw_incentives/models.py`; new `src/dfw_incentives/native_review.py`, `packet_review_context.py` and `tests/test_native_funding_review.py`; Inertia new `src/grants/native-review.ts`, `test/grants/native-review.test.ts`; existing `src/grants/contracts.ts`.

**Original design interfaces:** The implementation exports `NativeFundingReviewService` in DFW and `createNativeFundingReviewAdapter` in Inertia; the following design names describe the retained contract. DFW planned `apply_review_effect(session: Session, decision: TrustedReviewDecision) -> ReviewEffectReceipt`. TrustedReviewDecision is constructed server-side, never accepted from member MCP: company/applicant, principal_id/type, domain_authorization_epoch, native_verification_time, interaction_id, item_id, target_kind/id/version/hash, workspace_hash, action, evidence_revisions. Receipt includes effect_key, result (`applied`, `replayed`, `stale`, `unauthorized`, `conflict`) and domain IDs. Inertia new `applyNativeGrantDecision(ref: NativeDecisionRef, deps: NativeReviewDependencies): Promise<ReviewEffectReceipt>` reads the authoritative native actor and result. NativeDecisionRef contains companyId, issueId, interactionId, itemId; dependencies are trusted native read and domain effect ports.

- [x] Cover agent/system actor, wrong/revoked human role at acceptance, partial card, defer, duplicate/reordered event, wrong company, changed document/packet/source, simultaneous decisions and source-update races in the reviewed native/durable suites.
- [x] Independently rerun the reviewed native/durable suites, including 47 focused DFW cases and the native PostgreSQL capture cases; retain exact [qualification evidence](testing.md#recorded-implementation-evidence).
- [ ] Qualify the production domain grant-review directory: an administrator-admitted organization/principal/scope grant with a monotonic authorization epoch, stored with domain data. Lock/recheck this grant and epoch in the same effect transaction; a role string from an event or agent is never authority. Native human identity, membership, role and source revision are checked and locked at acceptance; timeout/unknown authority fails closed. Native membership and domain grants live in separate stores. Later native revocation does not cancel a durable acceptance; require current domain-grant checks for transactional denial and explicit DFW confirmation for cancellation. Qualify real provisioning/revocation and source access before activation.
- [x] Implement final revision validation, guarded effect and exact-command replay receipt in one domain transaction; test the native adapter.
- [x] Implement and independently review atomic native verdict/receipt capture, trusted acceptance readback/sweeps, DFW exact-command application, funding-confirmed cancellation and changed-evidence rejection. Pass 36 native PostgreSQL cases, 20 separate DFW PostgreSQL cases and three synthetic-transport native-to-DFW rehearsals.
- [ ] Qualify authenticated production route/transport, lifecycle-compatible retention/archive, real role/binding/source access and least-privilege writer fencing. Preserve accepted receipts until terminal DFW acknowledgement or qualified durable transfer, then permit ordinary archival.
- [ ] Walk a real human through correction → regeneration → review and explicit DFW-confirmed cancellation; retain separate submission authority.
- [ ] Preserve accepted/corrected/rejected proposal operations and packet changes_requested semantics. Preserve partner-only N/A and required role mapping. Native review never submits externally or infers a DAO vote.
- [x] Pass separate real PostgreSQL concurrency qualification and reviewed publication in DFW PR50 and Inertia PR31. Exact-head and post-merge DFW CI passed; production integration qualification remains above.

## Task 8: General objective intake and opportunity brief

**State:** merged in Inertia PR27 and DFW PR46. Objective intake, versioned funding links and briefs passed independent review. The synthetic actual-service meeting-answer → scoped knowledge → follow-up → revised-brief rehearsal also passed; its portable supplement is merged in Inertia PR29. Production source/member exports, native visibility and assigned live intake remain activation work.

Meeting source/native composition is merged in Inertia PR34 and independently qualified with synthetic external I/O and actual native PostgreSQL/WAL. New/corrected publications reuse one reference-only native issue; summary-only sources create missing-transcript work. Qualify real source/website access, live installation capabilities, retention/recovery and transport bounds; resolve notes-only website output before claiming complete R-M02 acceptance.

Operational discovery foundation is merged in Inertia PR35/DFW PR51: same-plugin context/URL tools, bounded durable frontier/budgets, known-source preliminary briefs before packets, corroborated identity admission and existing signed Buzz transport. The source-bound funding-facts service/tool is merged in PR36/DFW PR52, with conservative conditional deadline/benefit interpretation and separately established eligibility. Qualify actual search/model behavior, active responsible-member wake mapping, document-history costs and human delivery, then rehearse and agree cadence/alert targets before recurrence.

**Files:** merged Inertia `src/intake/contracts.ts`, `src/intake/service.ts`, `src/grants/brief.ts`, `test/intake/service.test.ts`, `test/grants/brief.test.ts`; existing `src/paperclip/adapter.ts`, `src/worker.ts`, `src/manifest.ts`; merged DFW `src/dfw_incentives/opportunity_brief.py`, `src/dfw_incentives/objective_links.py`, model/migration and tests; extend the website integration proposal; production server rollout remains with its owner.

**Interfaces:** define `ObjectiveSubmission` in intake/contracts.ts: sourceId, revision, sourceHash, organizationId, authorRef, audience, title, text, withdrawn. `ingestObjective(input: ObjectiveSubmission, deps: IntakeDependencies): Promise<IntakeReceipt>` resolves trusted source authority and existing native mapping; receipt has status, sourceId, revision, nativeIssueId. Dependencies expose source readback, scoped native issue operations and durable mapping/reconciliation. Add trusted source ordering token or expectedPreviousHash, a unique mapping key (organization, source system, sourceId), and mapping-version CAS. Never lexically compare opaque revision strings. Serialize a pending create operation per key and reconcile unknown outcomes before any retry; if native lookup cannot establish presence/absence, remain pending. Apply only authoritative current revisions; retain a withdrawal tombstone. Audience narrowing suppresses derived output until native permissions converge; widening requires trusted source authority. `OpportunityBrief` is the spec's explicit presentation fields plus opportunity_id, project_ids, packet/version/hash, sources and gaps; DFW `build_opportunity_brief(context: dict[str, Any]) -> OpportunityBrief`; Inertia `renderOpportunityBrief(brief: OpportunityBrief): string` creates concise native-document Markdown.

**Durable funding links:** merged domain `ObjectiveFundingLink` with organization_id, objective_source_system/id, opportunity_id, revision, fit_rationale, requirement_refs, proposed_contribution, packet_id/version/hash, status and provenance. Unique (organization, objective source/id, opportunity); links retain version history. `upsert_objective_funding_link(..., expected_revision)` owns updates in DFW; `list_funding_for_objective(...)` and `list_objectives_for_funding(...)` expose both directions with audience filtering. Paperclip owns task state, website owns submitted objective content, DFW owns funding/fit/link state. Buzz and website views call these owners and reconcile versioned projections.

- [x] Tests: one submission delivered twice creates one issue; changed revision updates its linked issue; ambiguous creation reconciles without duplicate; withdrawal retains history; same text from two submitters stays attributable; hidden intake cannot appear in public output; revision 2 before 1, concurrent initial creates, audience narrowing and withdrawal racing an update cannot regress state. Test both funding-link lookup directions and conflicting link edits.
- [x] Run focused intake/brief and combined suites; retain exact final results in [testing.md](testing.md).
- [x] Implement durable source/native identity mapping, retry reconciliation and versioned objective/funding links.
- [ ] Configure explicit CEO intake assignment and admitted production source/member visibility.
- [x] Render the brief with separate application, delivery and reporting effort ranges and estimation basis; retain evidence gaps and concrete meeting decisions. Native questions/documents/cards remain the review UI.
- [x] Independently verify the synthetic actual-service meeting answer → scoped knowledge update → follow-up work → revised-brief rehearsal.
- [x] Publish the portable supplement in Inertia PR29.
- [ ] Qualify actual production source/host delivery.

## Task 9: Integration rehearsal and synchronized artifacts

- [ ] Run DFW full qualification on the dependency baseline, Inertia `npm test -- --maxWorkers=1`, `npm run typecheck`, `npm run build`, package verification and native-service integration.
- [ ] Rehearse one current public-only packet, independent critique, correction, native human decision, stale-source invalidation and repeated delivery. Run the same case across available actual runtimes.
- [ ] Rehearse one innovation submission and one meeting fixture; prove related work/funding links and query-first partner reuse. Persist useful deltas from an accepted and a rejected opportunity, then retrieve them during a second run.
- [ ] Record testing.md metrics and every unexecuted integration. Compare exact July originals when supplied through an authorized transfer. Continue current implementation in cloud.
- [ ] Update Inertia spec.md, testing.md, decisions.md, plan.md, HTML/Mermaid and editable deck together; add detailed DFW plan/tests to its repo. Preserve original PDF and existing artifact identities. Review and publish the synchronized set.

## Dependency order and stopping points

The CI, benchmark, candidate, route-review, public drafting/gap and portable-package foundations are merged. Qualify actual host/model behavior against the merged contracts. Independent v3 quality assessment and actual runtime qualification remain distinct from passing contract tests.

Task 6, partner graph and Task 8 intake/link/brief are merged. Independent cloud and synthetic meeting-answer rehearsals passed. Task 7 has DFW durable acceptance merged in PR50 and independently qualified native capture; host publication is merged in Inertia PR31. Production route/transport, retention/archive, real roles/bindings/source access, writer fencing and the human correction/cancel walkthrough remain gates; the legacy adapter stays default-disabled. The approved discovery loop extends Tasks 5, 6C/6D and 8; the foundation and source-bound funding facts are merged and independently qualified. Daily execution stays disabled until actual research/model and human-delivery qualification, end-to-end rehearsal and cadence agreement. Task 9 retains HTTP/UI, PPC2/VPS and production activation gates. Exact July replay and October discovery remain separate evidence tracks.

October discovery is complete and PR42 is merged with passing post-merge CI; temporary live jobs are removed. Select preparation under current owner priorities and deferrals from the dated [priority diligence queue](https://github.com/NetRxn/DFW-Gov-Fund/blob/main/government-funding-dfw/docs/discovery/2026-10-23-priority-diligence.md). Preserve the exact confidence overlay, automated routing dispositions and manual-source limits; the first DNS-failed scout, manual findings and dated replay remain historical evidence, separate from July improvement.

External inputs: admitted source access, actual Helix compatibility, selected local runtime, actual human-role mapping, website server admission and production migration plan. Unfinished permitted research stays with agents. Ask people only for prepared, independently reviewed decisions or unavailable records/access. Keep artifacts synchronized as each status changes.
