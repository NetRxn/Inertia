# Settled recovery hand-back prompt projection

The native recovery-resolution route can return a task to its existing owner and
enqueue `issue_recovery_action_restored`. The original pinned wake builder still
projected the settled disposition repair as active recovery instructions, telling
the owner to repair the task instead of performing its current work.

This downstream overlay changes only that wake's prompt projection. It omits the
obsolete `recovery` object only when the database action is resolved, handed back,
has a resolution timestamp, and has the exact `deliberate_wait_without_target`
kind/cause. Its source issue and return owner must match the expected restored
context, current issue and current assignee. A fresh same-company issue read,
rather than an optional supplied summary, verifies the owner and actionable
`todo`/`in_progress` status. Any current active or escalated recovery action on
that issue, replay-blocked evidence, or mismatched context preserves recovery.
The existing execution-reconciliation projection remains unchanged.

No recovery action, issue, run, wake, grant or scheduler record is modified.
Settled recovery history stays in storage. This is not admission authority and
does not authorize task execution past a current recovery hold.

## Current task instructions and polluted sessions

The stock renderer treats `issue_recovery_action_restored` as assignment-shaped.
It selects the complete current assignment markdown for both fresh and resumed
sessions. The qualification checks the actual pinned selector and prompt renderer;
removing the stale recovery object does not remove the current task brief.

Provider history can still contain earlier repair instructions. When an operator
has verified the agent is paused, all relevant runs are terminal and no executor
or owner remains, the existing board-only API can reset that exact task binding:

`POST /api/agents/:id/runtime-state/reset-session`

```json
{"taskKey":"<exact source issue UUID>"}
```

The supported route checks current agent-management authority and audits
`agent.runtime_session_reset`. With a task key, it clears the current task-session
binding and same-company issue aliases for the current adapter, clears the global
runtime session ID/error, and preserves unrelated `stateJson`. It does not delete
run, recovery or domain history. This is a separate authorized operator action;
the overlay does not invoke it or add an automatic reset policy.

Do not infer a queued wake from a no-op resolution. The stock resolve route
enqueues only when the restored issue status or assignee changed. Reconcile the
actual stored wake/run and current hold before one targeted native validation.
Verify the provider receives the current full task instructions and records the
intended effect; do not loop repeated no-op model attempts.

## Exact composition and qualification

Run `scripts/apply-native-recovery-handback.mjs` last, after the previously
qualified overlays including native reconciliation and agent tool restrictions.
It accepts only the exact old or exact new heartbeat file, pins the unchanged
renderer and previous security/authorization/SDK/policy/gateway guards, rejects
drift or symlinked targets before mutation, and verifies the final hashes. It
starts no service and changes no runtime/session state.

Older installers intentionally require their own qualified heartbeat hash. They
are upstream stages, not final-state verifiers: rerunning them after this new
downstream overlay must fail rather than accept an unqualified new hash. A fresh
composition runs the complete existing sequence once, then this installer. Use
this final installer to verify the composed state; do not weaken the older pins.

The tests use actual pinned wake/renderer code with synthetic native SQL rows,
including a newer active hold and mismatched owners/issues/contexts. Installer
tests verify exact installation, idempotence and guarded refusals. Source tests
do not establish deployed authentication, provider-session freshness or model
behavior; those remain the single targeted native validation gate.
