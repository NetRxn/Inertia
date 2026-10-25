# Optional native gap-plan review — sanitized source plan

## Goal and constraints

Provide a default-off seventh reviewer tool for independent machine review of
public research preparation, without changing the six existing declarations or
candidate SHA contracts. No runtime activation, provider call, grants, secrets,
new queue/store/router, graph mutation, human acceptance or submission.

## Contract

- Administrator `nativeGapPlanReview: false`; enabled requires both native case
  progression and dependency handoff plus the matching pinned domain protocol.
- Ordinary SDK manifest declares the optional tool definition, not a grant.
  Flag-off effective registration remains six; enabled calls still require the
  configured reviewer and fresh authority. No alternate manifest/loader or new
  grant. Effective runtime admission remains separately qualified.
- `review_funding_gap_plan` has strict `operation: "context" | "admit"` branches.
  Context optionally accepts a UUID (omission, not null, means discovery).
  Admission requires UUID plus the returned `GapPlanReview` artifact contract.
  No model identity, authority, path, case or replay-policy fields.
- Bridge operations: `gap_review_context` and `review_gap`. Gap callback and
  pending reply have explicit `kind: "gap_plan"` and UUID; candidate wire shapes
  remain unchanged.
- Admission result: gap kind, UUID, `handoff_ready | rework_required`, and combined
  candidate-plus-gap pending count. Only zero can finish reviewer processing.
- Existing fresh identity/checkout/pause/live-run/dependency checks and domain
  progress-head freshness/receipt/freeze protocol remain authoritative.

## Implementation and evidence sequence

1. Copy the reviewed public source into an isolated local branch, preserving
   all unrelated and CI blobs; keep local provenance out of publication delta.
2. Observe focused RED for flag gates, strict inputs, independent reviewer,
   typed UUID callbacks, context/result contracts and combined pending lifecycle.
3. Implement optional registration/configuration and transport using existing
   authorizers and native snapshot helpers. Preserve six declarations exactly.
4. Observe focused GREEN, run drafting/context tests, typecheck and build. No
   aggregate suite or CI project is part of this checkpoint.
5. Run one separate synthetic cold paired transport fixture, explicitly labeling
   native admission transitions as fixtures, then obtain independent source
   review before publication disposition. No runtime activation follows from it.

## Remaining live gates

An owner label is not recipient eligibility. Owner-ready preparation is not
human escalation delivery, executor terminality, provider review quality or
next-case scheduler autonomy. Explicit native human resolution and fresh
producer scheduling/admission remain separate qualification requirements.
