# Native-first grant integration contract

**Planned, not shipped.** Reuse the [source-pinned primitives](../reference/native-grant-workflow.md). Current runtime, packet core and qualification receipts are unchanged.

## One workflow, two stores

Paperclip agents scout and draft using the funding skill/CLI/MCP harness. Native tasks, documents, questions, human-only cards and run history provide the default experience. The funding backend retains domain evidence, validated proposals, immutable packets and review audit. Its UI is optional specialist/admin fallback.

Use one native scheduling owner for each scan/draft job; disable overlapping funding triggers. Do not add a grant task board, scheduler or approval ledger.

## Scoped execution

Central and member agents share skills/tool schemas, not credentials or unrestricted data. Each run receives task-authorized evidence, applicant/workspace references and allowed proposal targets/evidence IDs. Member execution stays in its scoped sandbox/worktree.

A server-enforced tool boundary separates proposal writes from human-decision writes. Do not deploy the existing database-capable MCP unchanged onto member hosts with privileged access. No organization database, database-admin/reviewer key or portal credentials enter member environments. Agent outputs remain proposals, never signoffs.

## Human-decision adapter

A trusted server component applies already-authenticated Paperclip decisions through funding-domain services. This is new work: current MCP does not expose proposal acceptance or packet signoff.

1. Create native per-item verdict/role cards with explicit `resolverPolicy: human_only`, configured `addresseeUserId` and current document-revision targets. Configure actual authorized people, not agent-provided reviewer names.
2. Read the authoritative native result; verify company, applicant, interaction, addressee, authenticated resolver and configured role. For item verdicts, read each item’s actor/verdict: the card may still be partially pending, and its final resolver is not every item’s reviewer. A claimed decision ID or an agent narrative grants no authority.
3. Recheck exact workspace hash, allowed proposal target/evidence, latest packet version, review and external artifact bytes before applying. Preserve eligibility, deadline/freshness, official-form and technical blockers. Close apply-time races with guarded domain writes, not preflight alone.
4. Map proposal approve/reject to `accepted`/`rejected` through `CodexAgentService.review_suggestion`. Map packet-role approve/reject to `approved`/`changes_requested`. Defer makes no domain write. Offer partner `not_applicable` only as an explicitly labeled, role-specific native confirmation/action; never infer it from defer/reject. Apply signoff only for the configured role and route.
5. Persist native decision identity, authentic resolver, role, proposal/packet identity and version, action and domain outcome. For per-item review, decision identity is **native interaction ID + item ID**, not an invented item decision ID. Reconcile by **decision identity + proposal/packet ID and version + action**; never collapse distinct items in a partially resolved card. Handle a crash between systems by authoritative readback; apply once and hold unknown outcomes. No cross-system atomic transaction is claimed.

Initial correction path: edit native document → regenerate a proposal against the current workspace → request new review. Native verdict UI is not a structured field editor. Add a thin specialist panel only after a real packet walkthrough demonstrates material field/budget correction friction.

## Packet and vote boundary

`ReviewedGrantSource` reads funding records consistently and supplies exact artifact bytes; it is not a separate-UI export requirement or a claimed existing HTTP endpoint. See [implemented packet contract](../implementation/grant-packet-binding.md).

The shipped Inertia freeze/vote core accepts only direct-application manual submission with all five role checks. Other route rules belong to the funding domain/planned review adapter; this revision adds no vote/submission support for them.

The frozen canonical payload already contains reviews. Include authenticated native decision references consistently in domain review provenance before creating a vote; qualify any serialization change before claiming support. A changed packet, artifact or review needs a new snapshot and vote. Native document revision checks do not replace artifact hashing.

Vocdoni verification remains separate: require exact network/proposal/action/packet binding and effective final authority. Neither native card resolution, task completion nor a passed vote submits to a portal. An addressed human performs the separately authorized submission; the domain service records its receipt only after its readiness gate.

## Implementation acceptance

Configure roles and scoped transport; walk one real packet and correction; then implement the adapter and durable reconciliation. Run planned T-G06–12 in [testing.md](../../testing.md#native-grant-review-acceptance-planned), including wrong human/role, agent denial, stale bytes, duplicate/crash, reject/defer, partner-only N/A, cross-applicant access and no submission side effect. Source review is not deployed-instance acceptance.
