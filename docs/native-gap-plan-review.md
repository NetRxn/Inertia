# Optional native gap-plan review

This source extension adds one **optional seventh** public drafting tool,
`review_funding_gap_plan`, for independent machine review of existing public
research preparation. It does not activate a runtime, grant a tool, approve a
funding application, submit anything, or deliver an owner escalation.

## Explicit opt-in, unchanged default

The six existing `publicDraftingTools` declarations and candidate SHA-256
contracts are unchanged. `nativeGapPlanReview` defaults to false; false is
omitted from authorization-fingerprint material. Enabling it requires both
`nativeCaseProgression: true` and `nativeDependencyHandoff: true`, matching
administrator-pinned domain protocol/configuration, and the existing distinct
producer/reviewer bindings. No model argument can enable any flag.

The ordinary SDK manifest statically declares the optional tool definition.
**A declaration is not a tool grant or callable admission.** With the flag off,
only the six existing drafting handlers are registered. With the flag on, the
seventh handler still requires the configured independent reviewer and fresh
native/domain authority; configuration drift revokes it. Producer and other
unassigned identities cannot call it. The matching domain protocol separately
denies gap operations while disabled.

No manifest variant, alternate loader or automatic tool grant is introduced.
`package.json`, the default loader and existing agent grants remain unchanged.
Native tool admission, matching runtime pins and deployed configuration still
require explicit qualification; this source change does not activate them.

## Strict operations

Only the configured, currently authorized reviewer can call:

```json
{"operation":"context"}
```

Omission discovers bounded pending gap plans; an exact canonical UUID
`request_id` retrieves the corresponding current request/completion. `null` is
invalid. Context never admits an artifact. It returns `kind: "gap_plan"`,
`requests`, and `next_action` (`review_gap_plans` or `no_pending_gap_reviews`).
Each request includes its UUID, exact progress/workspace/requirement, public
support, untrusted-source instructions and the `GapPlanReview` output contract.
The response is bounded to 100 requests and 512 KiB; evidence is not silently
truncated to fit. A completed exact request may include `completed_review`.

```json
{"operation":"admit","request_id":"3fed4a00-4eb8-5e70-a206-883845154cf4","artifact":{}}
```

The UUID above is synthetic and the empty artifact is only a structural example:
use the exact request and the full returned `GapPlanReview` schema. Admission
returns `kind: "gap_plan"`, `request_id`, `review_state` (`handoff_ready` or
`rework_required`) and authoritative `pending_review_count`. These verdicts
concern preparation, not candidate acceptance or human authorization.

Branches reject additional top-level fields, inferred operations, candidate
SHA identifiers, model identity/case/path fields, or `replay_only`. Replay policy
is host-injected; identity always comes from the fresh native run and configured
principal. Although context itself is domain-read-only, the tool truthfully
advertises non-read-only effects because native checkout/lifecycle may change.

## Existing lifecycle and authority only

`save_funding_gap_progress` remains the producer mutation. Typed native review
callbacks carry `kind: "gap_plan"` and the existing scoped UUID; acknowledgements
are `{kind: "gap_plan", state: "pending", request_id: <UUID>}`. Legacy candidate
callback and acknowledgement shapes remain unchanged. Distinct gap-plan request
and completion document keys/titles and wake instructions name the optional
tool explicitly. Documents mirror domain state; they confer no authority.

Admission reuses the existing native identities, checkout, pause/live-run checks,
dependency graph readback and fresh authorization callbacks. The adapter never
edits the dependency graph, adds a queue/store/router, or creates a poller.
The matching domain protocol rejects stale/superseded progress independently
of workspace freshness, self review and conflicting receipts, and preserves
original review identity on exact authorized replay.

Authoritative pending totals include candidates **and** enabled eligible gap
heads. Either kind keeps the reviewer active while any review remains. Only a
zero combined count can finish reviewer processing. Dependency mode sends no
generic producer wake. A done reviewer with a still-live/queued run cannot be
reopened for the next callback. The existing frozen producer generation remains
frozen after gap completion; only a freshly admitted producer may read/rework the
full packet and checkpoint again. No new thaw path is introduced.

## Qualification boundary

Focused source adapter/transport tests and synthetic fixtures are not native
scheduler autonomy or provider-quality evidence. The optional tool still needs
explicit runtime qualification. An owner-ready preparation receipt is not proof
of delivered human escalation: a producer-supplied owner label is not an eligible
native recipient. Actual native human addressee/resolver eligibility, scoped
escalation delivery, reviewer executor finalization and fresh next-producer
admission remain separate live gates. No accepted/private document content or
private runtime identifiers belong in these public mirrors or documentation.
