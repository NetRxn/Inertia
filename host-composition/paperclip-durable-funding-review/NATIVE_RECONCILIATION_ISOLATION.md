# Native source-review reconciliation failure isolation

A historical source-review result may be reassessed after a later legitimate run completed its child. The unchanged source-review completion guard rejects that old live-admission identity. Reconciliation records exactly `native_source_review_scope_denied` through the existing failure recorder with `projectRunStatus:false`, then continues other rows. Existing supersession handling retires the old finalizer without changing the later status decision, original result or source-review evidence. All other commit errors propagate. Current unreviewed children still cannot become DONE.

The disposable actual PostgreSQL fixture starts the full server with heartbeat scheduling enabled, checks HTTP health and plugin READY, and repeats for omitted/default and operator-zero Coordinator capacity. It has no live state, providers or credentials.
