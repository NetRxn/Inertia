# Native funding review host composition

This document preserves the legacy through-commit adapter contract, which remains default-disabled. The independently reviewed durable successor captures exact-version authority atomically with native acceptance; DFW PR50 and Inertia host PR31 are merged. See the [durable successor activation contract](../../host-composition/paperclip-durable-funding-review/ACTIVATION-CONTRACT.md), [current native grant contract](../development/native-grant-workflow.md) and [publication/qualification record](../development/funding-enhancement/source-map.md).

Local qualification only. No worker registration, MCP tool, HTTP endpoint, new review UI,
new approval ledger, deployment or submission action is added.

## Native source and authority

`src/grants/native-review.ts` uses the installed official `@paperclipai/plugin-sdk`
2026.1012.0 types and `issues.listInteractions` / `issues.documents.get`.
Paperclip source pin: `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`:

- `packages/shared/src/types/issue.ts`: item actor/verdict and document-revision target.
- `server/src/services/issue-thread-interactions.ts`: `submitItemVerdicts` keeps partial
  results `pending`, marks complete results `answered`, and preserves per-item actors.
- `packages/plugins/sdk/src/types.ts`: native read capability surface.

A host-owned registration binds company, task, interaction + item, applicant, target,
version, workspace/head, source/evidence allowlists, configured human/role, exact
native document revision, and rendered card digest. Agent/event arguments contain
only registered interaction and item IDs, never authority. Current active human,
role and source scope must be checked by the host authorizer and again at domain apply.
The final card resolver is not substituted for a partial item's resolver.

Proposal approve/reject map to existing accepted/rejected semantics; role verdicts
map to approved/changes_requested. Defer writes nothing and checks for a conflicting
or uncertain audit outcome. Native document edits require regenerated proposals and
new registrations/cards. Partner `not_applicable` is deliberately not exposed by this
slice: it requires a separately labeled partner-specific confirmation, never an
inferred interpretation of defer/reject. No generic arbitrary corrected-value input.

## Required fence: live composition is disabled by default

The pinned plugin SDK does NOT expose a transaction/lease spanning native card,
document head and membership/scope authority through funding commit. A second read
cannot close that race. `NativeReviewFence` is an explicit host extension contract,
not an invented SDK API. Without it, `reconcile` returns blocked before effects.

To enable the composition, the trusted host must provide proven serialization (or an
equivalent immutable version-bound source guarantee) for the exact native card,
document revision and applicable authority for the entire effect callback. Native
writers must participate. A local mutex that native writers bypass, or a preflight,
is not sufficient. No adapter for that live host primitive is claimed here. Tests
supply only a synthetic immutable source fence; real native edit/cancel/revocation
concurrency and a real packet correction walkthrough remain release gates.

## Funding service contract

The DFW `NativeFundingReviewService` is a real domain-side implementation of the
`FundingReviewPort` semantics. Trusted composition maps `readOutcome` to
`read_outcome`, `applyGuarded` to `apply_guarded`, and authorizes against its own
current directory. No network transport, credentials or model-accessible review
endpoint is supplied. The schema uses identical camelCase registration/command keys.

The domain transaction must recheck latest version, workspace, actual head, allowed
targets/evidence and current roles/source scope, apply existing operations and append
native provenance to the existing funding audit atomically. Native identity is
company + task + interaction + item. Full command equality detects conflicting
replays. Native source fencing and funding transaction fencing are separate guarantees,
not a cross-database atomic commit claim.

A lost apply response triggers only authoritative audit readback, never a second
write in the same call. Unknown outcomes remain held. `not_applied` must exclude
in-flight transactions; only then may a later delivery retry. Existing success can
be read after process restart. A changed decision against a prior success is blocked.

## Final packet boundary

Packet roles preserve existing route, lifecycle, source and artifact checks; recording
review does not clear technical blockers. Registered artifacts are hash-verified.
Native provenance is retained in packet review audit before a later grant snapshot.
The existing five-role direct-application freeze/Vocdoni contract is untouched.
Neither card resolution nor audit success votes, submits, pays, uploads or creates a
manual-submission receipt. All real governance and submission acceptance remains
separately authorized and unqualified by this local slice.

A native packet role event retains an immutable packet-content fingerprint; DFW drops
that native approval on same-version packet/artifact retargeting. The provisioning
head also includes prior role reviews, so provision sequential role cards or reissue
the next card against the updated head. A retry reads the old exact durable receipt;
it does not reapply an old approval to the new head.

PostgreSQL receipt reads use a per-decision advisory lock; target inspection is read-only.
Domain application is disabled without a separately qualified PostgreSQL writer-fence
host adapter. Broad all-table locks exist only in disposable qualification fixtures,
not as production defaults or a request to expand grants.
