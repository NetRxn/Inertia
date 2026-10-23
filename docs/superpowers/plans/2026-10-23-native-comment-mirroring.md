# Native Comment Mirroring Implementation Plan

> For agentic workers: use superpowers:executing-plans for this approved, isolated implementation.

Goal: return native comments to explicitly authorized Buzz threads without another task engine.
Architecture: the existing native reconcile job scans bound comments, persists first-publication projections in the existing outbox, and revalidates before delivery. Defaults remain off. Paperclip remains task/identity authority.
Tech stack: existing TypeScript, plugin SDK 2026.1012.0, PostgreSQL and Vitest/PGlite.
Spec: approved design in parent task; the bounded contract is recorded below.

## Constraints and contract
- Binding configuration requires enabled, explicit destination-audience acknowledgement and ISO notBefore. No implicit history export.
- Only known user/agent author provenance and valid creation times qualify. Project body and generic author label only; never metadata or attachments.
- Stable receipt identity includes full binding and native comment ID. First signed event wins; retries preserve its bytes.
- Correlate native ingress receipts to suppress actual echoes, never a marker alone.
- Recheck binding, permission and unchanged live source before delivery. Suppress deleted/changed snapshots permanently; no edit sync or relay retraction.
- No new scheduler, credentials, live exports or publication. Parent handles root-artifact sync and independent review.

## Review focus
- Native source read failure must defer, not suppress or publish.
- Multiple companies/bindings must not publish or suppress each other's queued records.
- Revocation before delivery prevents publication, including queued retries.
- Unknown author provenance and invalid dates fail closed.
- Tied timestamps, large backlogs and restarts retain delivery identity.

## Task 1: Configuration and projection
Files: src/config.ts, src/bridge/types.ts, src/bridge/outbound-comments.ts; test/bridge/outbound-comments.test.ts and test/e2e/config.test.ts.
- [x] Write failing opt-in validation and pure projection tests; observe RED.
- [x] Implement strict opt-in, full-binding key, conservative source eligibility and minimal projection; observe GREEN.

## Task 2: Durable first publication
Files: src/bridge/service.ts, src/store/postgres.ts, migrations/005_outbound_comments.sql; test/e2e/outbound-comments.test.ts.
- [x] Write failing real PostgreSQL/service tests for scan, replay, retry, echo, revocation, source mutation and batching; observe RED.
- [x] Add lookup/correlation and suppression to existing outbox; scan inside reconcile with bounded enqueue work and delivery-time checks; observe GREEN.
- [ ] Run complete tests, typecheck, build and package verification. Commit review-ready implementation, no push.

## Execution notes
- Base: a6a7c9155a52cbfd37c257c50a88628917f82911; isolated feat/native-comment-mirror.
- Baseline verification in /tmp/inertia-mirror-baseline.log.
- Ruling: preserve deleted/edited pending comment IDs as suppressed tombstones; never resurrect via retry-blocked. Already published content is not retractable in this slice.

- Verified RED→GREEN for consent, mirror integration, non-string dates, outage isolation and initial scan-health status.
- Ruling: a native comment-read outage must not block unrelated delivery receipts. Scan failures surface retrying without inventing pending-receipt counts.
- Existing 152 tests passed; first implementation suite passed 167 tests. Final suite includes one additional initial-scan-health regression and remains pending at candidate commit.
- Package verification first hit an unavailable default npm cache path, then exposed the new runtime document missing from the package allowlist. The cache was explicitly set to the existing writable cache and the allowlist was updated; final package verification is recorded in the handoff.

## Independent review corrections
- Reviewer reproduced stale pending snapshot publication after another worker terminally suppressed it, and skipped invalidation of blocked/deferred snapshots. Real PostgreSQL regressions reproduced both before the fix.
- Approved ruling: use a non-expiring atomic publishing claim plus suppression_requested in the existing outbox. A claim is the in-flight boundary; no automatic expiry or stealing is allowed. Abandoned claims are health-visible and recover only after verified prior-worker termination, preserving the same event. This trades exceptional manual recovery for safety against paused handlers.
- Bounded rotating invalidation now covers pending, deferred, blocked and publishing rows, including removed bindings through persisted company scope.

- Follow-up review correction: publishing health is company-scoped across persisted bindings/relays, including disabled connections. Removed/changed bindings and disabled connections cannot hide interrupted claims; disabling requests durable suppression in bounded batches without external I/O. RED→GREEN regressions cover each transition.

- Verification fixture correction: store tests previously applied only migrations 001/003; updated them to apply the full ordered migration set after claim columns were introduced. Relay-change health regression disables publication on the new binding so it isolates the old in-flight claim rather than rejecting a separately authorized new-destination publication.
