# Operator-controlled native Coordinator child capacity

The trusted agent adapter configuration may set `nativeCoordinator.childIssueLimit` to a nonnegative safe integer. Omission preserves the native helper default of 25. A positive integer is an explicit per-parent helper limit; zero disables this helper count limit for that admitted Coordinator. This does not change execution concurrency, agent permissions, assignment scope, dependencies, recovery, or other helper callers.

Apply through the normal owner-authorized agent configuration API, preserving the existing adapter configuration and safety flags. Native admission rereads and compares the exact current policy before mutation; changing the setting revokes stale bindings. The model has no tool argument for this setting. Only a server-created Symbol carries the admitted policy to the existing child helper, and the Symbol is removed before issue creation. No historical child is hidden, deleted, or reclassified.
