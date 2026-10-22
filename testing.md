# Inertia testing requirements and plan

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

## 1. Execution status and evidence rules

**Every test below is Planned / Not run.** This document defines tests before implementation. Artifact rendering and document checks are not application, integration, or security test passes. No scans, live votes, submissions, services, or monitors have been started by this planning revision.

A test record must capture test ID, requirement IDs, build/commit, environment, policy/schema versions, fixture hashes, actor identities/roles, setup, action, observed result, timestamp, evidence links, pass/fail, and reviewer. Redact credentials and avoid raw restricted meeting content in logs. Negative cases must demonstrate denial and absence of unauthorized state changes, not merely an error message.

Use isolated test accounts, two distinct member identities, public or synthetic client bundles, an approved meeting fixture with real transcript-capable input, and a separate summary-only fixture. Use a separately authorized non-production vote environment where available. A mocked vote or recorded fixture must be labeled as simulated and does not prove live integration. Do not create or use external resources without the necessary authorization.

## 2. Acceptance and test matrix

| Test | Requirements | Setup and action | Expected evidence / pass criterion | Status |
|---|---|---|---|---|
| T-M01 | R-M01, R-M02, R-M04 | Deliver one ready transcript-capable Meet/Gemini/Drive fixture within configured policy. | Immutable source/hash, cleaned faithful transcript and separate notes, automatic publication without per-meeting click, both readback hashes and authorized audience match. | Planned / Not run |
| T-M02 | R-M03 | Repeat the same event and source concurrently. | One logical meeting/version, same result references, no blind duplicate external publication. | Planned / Not run |
| T-M03 | R-M03, R-M04 | Correct source, retry failed upload, crash before write, and simulate timeout after successful external write. | New source creates a version. Safe retries converge. Ambiguous outcome reconciles destination state before replay. Original remains unchanged. | Planned / Not run |
| T-M04 | R-M02 | Use supplied-style summary-only notes, uncertain speaker attribution, and contradictory statements. | Notes preserve uncertainty and provenance. Missing transcript input is explicit. No fabricated transcript, decision, owner, or legal fact. | Planned / Not run |
| T-M05 | R-M01, R-M04 | Incomplete Gemini output, missing input, denied folder access, changed destination scope, and exhausted retry budget. | No premature or overbroad publication. Actionable exception includes reason and recovery path. Normal cases remain automatic. | Planned / Not run |
| T-G01 | R-G01 | Compare historical July candidates with current source evidence and missing applicant facts. | Shortlist records checked-at/source/expiry and direct or partner route. Expired opportunities excluded or labeled. Unknown DAO facts remain unknown. | Planned / Not run |
| T-G02 | R-G02 | Generate a template-first draft with cited model suggestions and attempt acceptance without required review/signoffs. | Suggestions stay separate until human acceptance. Accepted version is immutable. Applicable role signoffs bind the accepted immutable version and block submission-readiness when missing, not packet generation. | Planned / Not run |
| T-G03 | R-G03 | Vote on packet v1, alter to v2, replay vote event, use stale hash, or unresolved chain outcome. | v1 decision applies only to v1 hash and actual scope. v2 needs new authority. Duplicate handling and finality checks do not create false approval. | Planned / Not run |
| T-G04 | R-G03, R-G04 | Try to submit using vote alone, absent eligibility/signoffs/submitter authority, or claim submission without receipt. | No external submission or credentials granted. UI distinguishes draft, approved-to-submit, and actually submitted. No mandatory shortlist vote. | Planned / Not run |
| T-C01 | R-C01 | Two authenticated members pair agents, see eligible pending work, opt in, execute a bounded public/synthetic task locally, and return results. | Real client-side work and independent validation visible. Participation does not grant broad production access. Record model/runtime and limits without storing secrets. | Planned / Not run |
| T-C02 | R-C04, R-O01 | Send twenty concurrent claims for one job. Repeat with two jobs and retries. | Exactly one active lease per job version. Conflicting claimants cannot download or submit as owner. Ledger records attempts. | Planned / Not run |
| T-C03 | R-C04, R-C05 | Expire A, assign B with a higher epoch, submit/heartbeat A, then race revocation with a current heartbeat/result. | Server transaction ordering is documented. Old epochs and actions after committed revocation fail. B remains unaffected. Expiry uses server time and maximum deadline. | Planned / Not run |
| T-C04 | R-C04, R-O01 | Repeat same result key/bytes, reuse key with changed bytes, and crash between acceptance/outbox/publication steps. | Same receipt for identical retries, conflict for changed content, one accepted result per job version, recoverable outbox and reconciled side effects. No exactly-once external-write claim. | Planned / Not run |
| T-S01 | R-C01, R-C03, R-C05 | Anonymous, revoked, wrong-org, wrong-agent requests; change body member/agent/task IDs; forge operation scopes. | Every list, claim, download, heartbeat, result, status endpoint checks authenticated identity and current authority. No cross-member metadata leak or privilege increase. Fail closed when policy unavailable. | Planned / Not run |
| T-S02 | R-M04, R-C02, R-C05 | Member A requests B’s bundle/results without explicit shared-task permission. Inspect bundle manifests and seed fake secret canaries in excluded configs and private sources. | Unauthorized cross-member access denied. Only approved public/synthetic files distributed under proposed demo policy. Canaries absent from bundles, logs, previews, outputs. Meeting audience unchanged. | Planned / Not run |
| T-S03 | R-C03, R-C05 | Replay expired/revoked credentials, reuse pairing code, change organization, access stale download, exceed rate limits, and send cookie-authenticated mutation without CSRF token. | Narrow revocable credentials enforced, pairing is single-use, no privilege escalation, TLS and selected anti-abuse/CSRF protections effective. | Planned / Not run |
| T-S04 | R-C02 | Try home/SSH/cloud credential reads, main checkout/common Git access, Docker socket, host writes, privileged mounts, fork/memory/disk exhaustion. | Reference sandbox denies access or terminates within configured limits. Capture runtime configuration and actual observed behavior. Worktree isolation alone cannot pass. | Planned / Not run |
| T-S05 | R-C02 | Attempt arbitrary internet, production API, metadata endpoint, and unauthorized model-provider egress. | Default-denied runner network and allowlisted adapter enforce policy. No production credentials. State explicitly that a member owner can bypass local restrictions and retain downloaded data. | Planned / Not run |
| T-S06 | R-C03 | Submit traversal, symlinks, oversized content, script/HTML, unknown schema fields, forged hashes, changed base, executable/config/workflow changes, or client “passed” flags. | Private quarantine, server-generated paths, independent hashes/schema/citation/content checks, safe rendering, no client-selected command/module/destination. Failed validation cannot publish. | Planned / Not run |
| T-I01 | R-M02, R-G02, R-C03 | Source/output injection requests DB secrets, new destinations, broader sharing, forged governance, or ignoring policy. | No credential access or authorization change regardless of model response. Trusted publisher selects fixed destination from policy. Prompt filtering alone is insufficient. | Planned / Not run |
| T-O01 | R-O01 | Recover process restart, exhausted retries, dead workers, and rejected results; inspect audit events. | Durable state survives restart, exceptions actionable, every transition records actor/job/epoch/policy/hash/reason, no secrets or raw restricted transcripts. Application roles cannot alter audit history. | Planned / Not run |
| T-O02 | R-D01 | Inspect integration configuration, adapter read/write scope, database/storage lineage. | DAO PlanetScale/Drizzle retained, grant storage separate, no undocumented migration/shared DB assumption. Ledger location selected explicitly. | Planned / Not run |
| T-Y01 | R-Y01 | Register a test interest, deliver a repeated source update, relate it to work, close the work. | Evidence URL/observed time/related ID preserved, duplicate alert deduped, workflow receives update, watch retired. A simulated adapter is labeled and access limitation disclosed. | Planned / Not run |
| T-A01 | R-A01 | Review all five deliverables against latest decisions and IDs; compare repo and Library revisions, relative links and public-facing content including speaker notes. Verify the exact remote commit and artifact bytes after publication. | Same revision/date and index, all requirements mapped, decision status consistent, no stale source-unknown/Helix/core/two-objective language, editable seven-slide deck, no newly generated PDF; original overview preserved unchanged with historical-source label. Documentation QA is recorded separately from application test execution. | Planned / Not run |
| T-X01 | R-X01 | Only if stretch is approved: inspect 990 access/API, permitted query, provenance, freshness, and failure behavior. | Existing read-only service used within approved access. No inferred backend/API or unapproved sensitive disclosure. Baseline unaffected if unavailable. | Planned / Not run |

## 3. Conditional integration security tests

If GitHub webhooks enter the selected baseline, add T-H01 (R-C03, R-O01): validate GitHub HMAC-SHA256 over raw body with constant-time comparison, expected installation/repository/event/action, changed-body detection, and delivery-ID deduplication. For another provider, use that provider’s documented authenticity and replay-validation scheme; do not assume GitHub’s HMAC contract applies to Google Drive. Bad/missing signatures and unexpected routing must cause no state change. A replay must be idempotent. Status: Planned / Not run; conditional on interface selection.

Never run returned code in a privileged GitHub Actions context with secrets. If code/diff jobs are enabled, add an isolated validator and negative cases for workflow/dependency/config changes, submodules, binaries, file modes, and revision drift before accepting those job types. The one-week proposal starts with bounded JSON/plain-text results, not arbitrary archives or executable contributions.

## 4. Test phases and release gates

1. **Contract fixtures:** finalize source types, task schemas, auth policy, exact packet identity, adapter error semantics, and expected outputs before implementation (P1 in plan.md).
2. **Unit and component tests:** hashes, schema rejection, policies, state transitions, lease fencing, idempotency, outbox state, and source fidelity fixtures (P2–P4).
3. **Integration tests:** approved Drive/website path, grant adapter, selected governance adapter, real client pairing, Y2 contract or clearly marked fixture (P3–P5).
4. **Adversarial tests:** execute T-S01–T-S06, T-I01, lease races, malicious outputs, and conditional webhook tests in isolated environments (P4–P6).
5. **Demo rehearsal:** show all three objectives, access denials, expiry/reassignment, recovery, and audit/readback evidence (P6).

Do not claim secure isolation if sandbox, scope, secret-absence, validation, or stale-lease tests fail. Do not call a mocked integration live. A blocked real transcript or vote integration remains a visible blocker rather than a fabricated success. No production certification follows from this demo test plan.

The demo evidence pack must include one automatic meeting publication with both artifacts and readback, one current-evidence packet with review and exact-version governance evidence, and two member identities with real client-side contribution, contention/expiry recovery, independent validation, and denied unauthorized cross-member access. Y2 remains planned and should demonstrate a real update if access is ready, or a labeled contract fixture plus unresolved integration status. No funder submission is required.

## 5. Traceability and sources

Requirement definitions and factual sources: spec.md §§3–8. Decision dependencies: decisions.md D01–D16. Proposed execution phases: plan.md P1–P6. The architecture deck summarizes these boundaries and is not a substitute for this test matrix.

Security references informing proposed tests:
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- https://git-scm.com/docs/git-worktree.html
- https://docs.docker.com/engine/security/ and https://docs.docker.com/engine/security/seccomp/
- https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- https://docs.github.com/en/actions/reference/security/secure-use
