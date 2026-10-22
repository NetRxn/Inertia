# Inertia implementation plan

Revision: INERTIA-2026-10-22-r4  
Updated: 2026-10-22 (UTC)  
Status: Planning baseline. No implementation, deployment, scan, or application test execution is represented as complete.

## Synchronized artifact set

- [spec.md](spec.md): requirements, boundaries, contracts, and sources.
- [testing.md](testing.md): acceptance and security tests defined before implementation.
- [decisions.md](decisions.md): confirmed decisions, proposals, and unresolved choices.
- [plan.md](plan.md): proposed sequence, dependencies, and evidence gates.
- [Inertia-Architecture.pptx](Inertia-Architecture.pptx): editable seven-slide architecture view.

All five artifacts carry the same revision. Future user updates must reconcile all five, including explicit no-change checks. Preserve stable filenames and IDs, record superseded choices, and do not silently convert proposals into confirmed decisions. No newly generated PDF is part of this active set. The original [product overview](docs/reference/Inertia-beta-product-overview.pdf) is preserved unchanged as historical source material; its older sequencing does not override these current artifacts.

## Change summary

- Confirmed public project home: [NetRxn/Inertia](https://github.com/NetRxn/Inertia). Owner authorized publication of these artifacts and the original overview. Use focused branches, reviewable commits and pull requests; implementation and deployment remain separate.

- Confirmed Google Meet recording and Gemini processing, with outputs in the organization’s Google Drive folder. Folder IDs, exact output types, readiness signals, access, and retention remain TBD.
- Confirmed PlanetScale PostgreSQL for the DAO website. Preserve existing storage and de-prioritize Helix.
- Added the required member-agent contribution objective with client-side sandboxed execution, worktrees, and server-mediated result acceptance.
- Retained the grant packet submission vote and Y2 watch loop. Integration with the existing 990 workbench is a stretch TODO.
- Added a requirement-to-test map, security gates, decision statuses, and a proposed one-week implementation sequence.

## Objective and authorization boundary

Prepare a credible demonstration of all three required objectives by October 29, 2026, ahead of the October 30 HackFW deadline. This is a proposed implementation handoff, not authorization to build or deploy. No code changes, service creation, scans, monitors, votes, or grant submissions have been performed as part of this revision. Named roles below are proposed owners, not commitments from individuals.

The baseline uses existing website and grant-engine capabilities, one selected durable runtime, one narrow member task type, and adapters with explicit contracts. Keep security enforcement mandatory without adding governance votes to routine work. The architecture deck is a readable overview, while spec.md and testing.md define detailed acceptance.

## Dependency-ordered work plan

| Phase | Target | Proposed owner | Work and dependencies | Exit evidence |
|---|---|---|---|---|
| P0: Documentation bootstrap | Oct 22 | Documentation maintainer | Publish the approved public-safe baseline and unchanged original overview on a focused branch with a draft PR. Update README navigation; verify exact remote commit and file hashes, artifact revision consistency, links and deck. | All six requested files present (four Markdown artifacts, deck, original PDF); public-content and documentation QA evidence. No application tests implied. |
| P1: Contracts and fixtures | Oct 22–23 | Product, meeting/site, grant/governance, security owners to assign; Y2 teammate to confirm | Resolve D02–D04 source/access/readiness/publication contract; D08 runtime/ledger; D09–D12 narrow client job/auth/sandbox/policy; D07 vote adapter/finality; D13 Y2 access. Select current grant candidate and explicit unknown applicant facts. Define test fixtures before code. | Reviewed contracts, source types, approved data/publication policies, owner assignments, current candidate evidence, test fixtures and expected outcomes. Blocked fields remain visible. |
| P2: Ledger and trust boundary | Oct 23–24 | Platform/security owner to assign | After P1 selection, implement task/run/claim schemas, member/agent authorization, atomic leases and fencing, immutable receipts, unique acceptance, audit and outbox/reconciliation. Reuse existing runtime capabilities where sound. | T-C02–04, T-S01, T-S03 and core T-O01 evidence. No production secrets in client bundles. |
| P3: Automatic meeting path | Oct 24–25 | Meeting/site owner to assign | With approved Drive and website access, ingest ready original, derive faithful transcript and notes, preserve versions, publish automatically in fixed scope, read back, retry/reconcile and queue exceptions. Use trusted runtime for restricted material. | T-M01–05, relevant T-S02 and T-I01. Demonstrate both artifacts from transcript-capable source and honest summary-only handling. |
| P4: Grant, governance and Y2 adapters | Oct 25–27 | Grant/governance owner to assign; Y2 teammate | Use existing engine and current evidence, prepare/review exact packet, collect relevant signoffs, bind vote ID/outcome to version/hash using chosen adapter. Connect registered-interest Y2 evidence into workflow. Actual funder submission excluded. | T-G01–04 and T-Y01. Live versus simulated integration labeled. Missing adapter access remains a blocker, never a false success. |
| P5: Member-agent contribution | Oct 25–27, parallel to P4 after P2 | Client/runtime and security owners to assign | Pair two members’ agents, list/claim approved public/synthetic work, run one bounded job client-side in selected sandbox, return JSON/plain-text result, independently validate and publish only through trusted service. Include expiry/reassignment. | T-C01 and T-S02, T-S04–06, T-I01. Real local execution, denied unauthorized cross-member access and actual sandbox configuration captured. |
| P6: Adversarial rehearsal and freeze | Oct 28–29 | Demo owner plus reviewers to assign | Run all baseline tests, race/recovery cases and a coherent end-to-end demo. Reconcile artifacts with actual implementation and remaining limitations. Freeze exact packet and evidence bundle for rehearsal. | All baseline applicable tests have explicit pass/fail/blocked evidence. No unresolved critical security failure. Same revision in all five artifacts. Demo script and evidence links ready. |

P4 and P5 can run in parallel only after P2’s authoritative authorization and claim contract exists. October 30 is the stated deadline, not extra planned development capacity. If P1 lacks real source or governance access, immediately escalate the precise missing contract/permission. A labeled fixture can help development, but cannot satisfy a claim of live end-to-end integration.

## Minimal demo sequence

1. Show the confirmed Meet/Gemini/org Drive source path and a ready authorized meeting input. Automatic processing produces separate cleaned transcript and notes, preserves the original and versions, publishes to the configured authorized audience, and shows readback. Repeat the event and demonstrate safe deduplication. Show a recoverable failure and reconciliation evidence.
2. Show a current source-backed grant shortlist, explain direct versus partner route and missing facts, review a packet, freeze its ID/version/hash, and display the matching blockchain decision on whether to submit. Change the packet and show that old approval no longer applies. State that actual funder submission is separate.
3. Show two authenticated members with their own agents. One claims a bounded public/synthetic job and runs it locally. Demonstrate contention or lease expiry/reassignment, denied unauthorized cross-member access, independent result validation, and a trusted publication step. Show a malicious or stale result rejected without server side effects.
4. Show Y2 registered interest and a source-backed update tied to the relevant work, including retirement when closed. If access is unavailable, label the fixture and integration gap explicitly. Keep this planned component visible rather than silently dropping it.

## Scope control and contingency

- Keep the first member job non-executable and bounded, such as cited extraction from a public grant source. Defer arbitrary code jobs until their isolation and validation tests exist.
- Retain existing PlanetScale/Drizzle and grant storage. Choose the ledger’s product/storage owner explicitly. Adding tables to a selected existing database does not imply merging all systems.
- Paperclip may cover both management and orchestration. Do not build another scheduler by default.
- Prefer a small proven runtime over unverified Cloudflare-specific services. Availability is not readiness.
- Restricted meeting data stays trusted under the proposed client policy. Do not weaken the boundary merely to make the demo easier.
- Keep Helix de-prioritized. 990 search is stretch after P6 core gates. TexasNova remains a reference resource.
- Never bypass failed security tests, invent transcript text, call historical opportunities current, or label fixtures/live votes/submissions inaccurately.

## Change and synchronization workflow

For every new user fact or direction:
1. Identify affected requirement IDs and source/date, distinguish a confirmed change from a proposal, and note contradictions.
2. Update spec.md’s contract and requirements, then testing.md’s expected behavior and coverage before implementation changes.
3. Record confirmed/proposed/TBD consequences in decisions.md and adjust dependencies/targets in plan.md.
4. Update the corresponding editable architecture slide and speaker-note references. Confirm all seven slides remain readable and consistent.
5. Increment the common revision across all five files, update each change summary/index, and cross-check IDs, dates, priority, source/provider descriptions, access boundaries, and demo scope. Keep stable filenames and historical versions. The prior PDF stays historical and is not refreshed.
6. Record actual implementation/test evidence only when observed. Mark tests Planned, Pass, Fail, Blocked, or Not applicable with reasons. This planning revision contains no application test passes.

## Completion criteria and sources

Implementation completion requires the requirement/test evidence in testing.md, not merely document completion or an attractive architecture diagram. Product/security reviewers must resolve or consciously defer TBD decisions, document any reduced demonstration claim, and preserve the required three-objective scope. Routine publication remains automatic within approved policy. External submission remains outside the demo.

Sources: spec.md §8. Decisions: decisions.md D01–D16. Tests: testing.md T-M01 through T-X01. Architecture slides: 1 system map, 2 meetings, 3 grants/Y2, 4 client trust boundary, 5 state/contracts, 6 tests, 7 delivery and decisions.
