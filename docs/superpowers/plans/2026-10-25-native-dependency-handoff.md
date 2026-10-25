# Native dependency handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opt-in fixed-pair exact-review/redraft handoff through existing native dependencies; preserve default behavior and six tools.

**Architecture:** The existing private run-binding receipt freezes a producer run after a pending-review handoff. The host verifies a preconfigured P-blocked-by-R relationship and uses native reviewer completion rather than generic producer self-wakes. Native admission/finalization owns continuation; missing lifecycle facts remain explicit qualification gaps.

**Tech Stack:** TypeScript, pinned Paperclip SDK 2026.1012.0, Vitest; optional narrow private Python AgentRun change only after parent approval.

**Spec:** Parent-approved source scope (2026-10-25 16:47 UTC), documented in `docs/native-dependency-handoff.md`.

## Global Constraints
- Publication stack: verified public PR84 `5f2bf6228cc0f6db6d995f51f3cc873461eef5bd` adapter prerequisites on develop `eceeac8eb83e3b480d68f3b0dd0d21a3b0b0a569`; preserve its fast-CI files and keep PR84's branch unchanged.
- No runtime/credentials/new tools/capabilities; no private edits until separately approved. No heavy suite or publication before parent disposition.
- Native completion never means domain acceptance/submission. No automatic gap-plan or next-case closure claim.

## Review Focus
- Old producer re-checkout after blocked status clears: authoritative per-run freeze must remain effective.
- Reviewer done with live prior run: no reopen, no claim of terminal/finalized execution.
- Lost acknowledgement after committed status: no restoration undoing dependency handoff, no duplicated wakes.
- Same pair reused over successive cycles: old exact review cannot reopen or retire a newer batch.
- Unrelated native blockers/pause/finalization: no status transition bypasses native admission.

### Task 1: Opt-in host/config and fail-closed native handoff
Files: src/drafting/host.ts, src/drafting/setup.ts, src/drafting/schema.ts; new test/drafting/dependency-handoff.test.ts; test/drafting/setup.test.ts.
- [ ] Add failing host tests for graph validation, old blocked run denial, reviewer done/live denial, all-pending completion, supported/rejected behavior, lost-ack and duplicate requests.
- [ ] Run focused tests and record expected RED assertions.
- [ ] Implement documented native subtree relation/active-run reads, require nativeCaseProgression with new nativeDependencyHandoff false-default flag, restrict status reentry, and end R only after zero authoritative pending reviews. Do not emit generic P wake in this mode or mutate graph.
- [ ] Run focused drafting/context tests and typecheck; document native finalization/pause tests as host-boundary tests, not an actual native scheduler proof.

### Task 2: Existing private run-binding freeze (approval required)
Companion domain implementation and its tests are maintained separately; this public stack contains only the adapter protocol and synthetic qualification tests.
- [ ] Add failing tests: exact pending-review receipt frozen on existing run binding, same-run write denied after native status changes, checkpoint replay exact, genuinely new run uses unconsumed selection, default behavior unchanged.
- [ ] Implement monotonic annotation on existing native-case-run-binding summary; retain selection_id and actor exactly. No new table/workflow queue. Require explicit configuration/protocol acknowledgement so public mode cannot silently use old private behavior.
- [ ] Run focused Python tests/Ruff and one cold cross-repository fixture if authorized; no whole private suite.

### Task 3: Independent review and handoff
- [ ] Ask a fresh reviewer to assess source diff, red/green evidence, identity, replay and lifecycle boundary.
- [ ] Fix important findings with red/green tests; document remaining actual-runtime gaps.
- [ ] Commit locally only; report exact commits/patches and verification to parent for publication disposition.
