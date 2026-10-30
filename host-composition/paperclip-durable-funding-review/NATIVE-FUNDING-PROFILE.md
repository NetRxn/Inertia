# Restrictive native funding role profile

Qualification baseline: Paperclip `2026.1012.0`, source
`bba6a45f0d364cfd962ac59b3bdf2426a8222adb`. This overlay applies after the
scoped native Coordinator overlay. It adds no grants, credentials, scheduler,
queue or automatic activation. Install with `npm run apply-native-funding-profile`
after the existing bootstrap, before the downstream guarded reconciliation,
agent-permission and recovery overlays. Their authority/policy guard hashes must
match the exact reviewed composition.

An administrator may configure an existing `paperclip_runner` **general** agent
with Codex provider, `engine: "cli"`, `codexPermissionMode: "never"`,
`disableCommandExecution: true`, `dangerouslyBypassApprovalsAndSandbox: false`,
and `nativeFunding: {version: 1, role: "producer" | "reviewer", projectIds: [...],
issueIds: [...]}`. Each ID list is finite (1–16 unique UUIDs). Unknown policy
fields, Coordinator/funding combinations, `args`/`extraArgs`, alternate native
backends, remote execution and managed GitHub are rejected. The current company,
agent, general role, native run, configured project and issue are rechecked for
catalog discovery and execution. Configuration is not a model argument.

Producer catalog is only the existing four canonical `netrxn.inertia` tools:
`funding_drafting_workspace`, `save_funding_proposals`,
`save_funding_gap_progress`, and `funding_drafting_checkpoint`. Native's existing
assigned-MCP channel projects those to its stable `app_*` names. Fresh gateway
admission is intersected with the session's pinned catalog; all four must remain
available. Generic assigned-tool search/call wrappers, semantic task/connection
catalogs and connectors are excluded. The existing gateway still authorizes and
audits every actual call, including retries; discovery is not an extra grant.

Reviewer catalog is only the five stock native review reads plus `resolve_review`.
The run must be a real currently admitted native review participant; changing a
role or reusing the producer assignee does not confer review authority. No assigned
MCP tools are exposed to this role. Funding-role task context deliberately omits
`acceptedPlan`, `sourcePlanApproval` and `childReviewOutcomes`; their empty values
are an audience ceiling, not a claim that native records are absent. Child rows
are queried only inside the explicit company/project/issue ceiling and exclude
hidden tasks. This does not change the Coordinator's separately scoped context.
`paperclip_finish` keeps its existing native runner contract for both roles.
Stock behavior is unchanged when this profile is not selected.

This profile alone does not admit a typed funding review or authorize native
acceptance. The paired domain bridge must validate the independent reviewer,
exact candidate and structured evidence before corresponding native completion.
Keep human acceptance and funder submission separate. Disable/reconcile legacy
coordination before a replacement binding is admitted; retain immutable history.

Run `npm run qualify:native-funding-profile` only in the supported disposable
qualification environment: no network, credentials, production mounts or provider
inference, nonroot, read-only root and bounded writable scratch. It exercises the
installed pinned authority, provider/parser roundtrip, exact catalogs, restrictive
settings, gateway intersection and hash-checked installer. Those checks are not
proof of actual model exposure or connected autonomous execution; both need the
separate bounded native acceptance trace.

## Native-attention producer metadata overlay

Apply `npm run apply-native-attention-deadline` after this profile and before
the downstream guarded overlays. This separate exact-hash overlay carries the
producer-only trusted flag through the existing assigned-MCP channel and reuses
the existing funding execution policy. The resolver requires the live native
producer policy, current task/run ownership, exact existing grants and a same-task
`publicDrafting.nativeAttention` binding with independent producer/reviewer identities.
Legacy Codex-local distinct-task approval remains unchanged. No model argument can
set the trusted channel flag; tool argument validation remains the handler's job.
The existing 120/160/170-second operation/RPC/gateway budgets remain unchanged.
Native-attention host handlers remain fail-closed without this authentic metadata.

Run `npm run test:native-attention-deadline-installer` against the exact qualified
server tree; the separate native PostgreSQL fixture exercises real gateway dispatch
and revocation without provider inference or production state.
