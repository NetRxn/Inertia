# Funding Facts Host Implementation Plan

Goal: compose authenticated source-bound facts review into existing native preliminary delivery without enabling runtime or granting eligibility authority.
Architecture: retain separate diligence actor, checkout, DFW identity handshake and immutable query documents. Use the current capture's validated identity receipt and Unicode evidence spans. Refresh existing discovery continuation and its revalidating material-event delivery, never a second alert route.
Spec: 2026-10-24-new-sponsor-facts.md. Parent-directed bounded implementation; Git writes remain with parent.

## Interface map
- diligence.ts: add funding-facts-submit, require current query/hash and current sourceIdentityReceiptId, validate exact evidence spans and response bindings, persist assessment receipt, invoke authenticated completion callback.
- funding-facts.ts: focused strict facts input and receipt contracts/validation; no caller actor, principal, policy or hash fields.
- service.ts: current candidate fundingEvidence and sourceIdentityReceiptId fields.
- stdio.ts: pinned assess_funding_facts request; existing process caps and deadlines preserved.
- preliminary.ts: optional conservative assessment details and pool/in-kind/unknown benefit text; legacy briefs remain accepted. Never render a pool as award value or infer exact cutoff.
- host.ts: refresh current assessed capture into existing continuation under owner and reviewer checkout, persist before existing delivery and retain supersession references/frontier.
- test/discovery: red-first actor/tenant/project, malformed spans/facts/receipts, stale/absent capture, budget, restart/semantic replay, supersession, conditional brief and alert tests. Real pinned subprocess qualification follows DFW readiness.

## Execution
- [ ] Write failing host tests and save red output.
- [ ] Implement bounded tool/contracts/completion and preserve first-slice known source paths.
- [ ] Run focused tests then complete host test/typecheck/build/package verification.
- [ ] Run combined pinned DFW qualification when service is ready; hand parent exact files/hashes/results for independent review.

## Constraints and review focus
Runtime default-disabled, no live access/configuration/recurrence/deployment/publication. No new dependencies. Dependency tree must be an isolated directory, not shared symlink. Read installed SDK runtime implementation for checkout, tool run identity and native document protocol; pinned SDK has no revision update token, so immutable snapshots stay mandatory. Current source reauthorization happens before replay/delivery. Date-only evidence remains cutoff/timezone unknown, missing facts stay agent-owned.
