# Native recovery delivery qualification

An applied reassignment is not proof of a provider invocation. Inspect its exact
`agent_wakeup_requests` receipt, including status, reason, run ID and idempotency
key, before another admission. Record the agent and task-drain state at the time
of dispatch. Do not treat a later operator pause as the cause of an earlier skip.

In the pinned host, a resolved recovery record can still carry an effective
`automaticRecovery.replay = blocked` hold. The ordinary issue projection's lack
of an active recovery action does not prove that no execution hold exists. Use
the native recovery API with actual termination and outcome evidence; preserve
the original run and any committed domain work. A never-started cancelled repair
can be `not_performed` without declaring an earlier preparation uncommitted.

The existing native reconciliation delivery worker is constructed only when
`HEARTBEAT_SCHEDULER_ENABLED` is enabled. This is separate from each agent's
`runtimeConfig.heartbeat.enabled`, which can remain false to prohibit timer
inference. Audit pending durable recovery intents before enabling that worker.
An older pending intent is not automatically superseded by later task runs.

## Minimal administrative correction

The reviewed overlay extends the existing board-only cancellation operation
with the explicit `withdrawPendingDelivery: true` flag. It cancels only an
undelivered, already resolved execution-reconciliation delivery intent. It does
not change task status, ownership, permissions, original outcome evidence or
provider state. A meaningful reason and the exact action ID are required.

The API refuses an active or ambiguous recovery, an effective no-replay hold,
changed task status, any non-skipped delivery receipt, or any bound successor.
Such outcomes require normal reconciliation rather than cancellation. Retried
withdrawals are idempotent. Original management state and evidence remain in
the withdrawal receipt, and the native activity log records the operator action.
No cancellation tool is exposed to models and no new endpoint or queue is added.

Use the exact reviewed host source, native HTTP regression tests and pinned
installer. Keep agents paused and task drain held during maintenance. Withdraw
only exact, verified obsolete intents through the API, then read them back.
Reconcile the current stopped run separately. Enable native delivery only after
queue audit, with agent timers still disabled and the same credential recipients.
Release drain for one bounded recovery proof; do not manually wake a successor
or describe an operator-assisted restart as uninterrupted autonomy.
