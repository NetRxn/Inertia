# Restricted native Coordinator

This opt-in overlay uses the existing pinned Paperclip native authority, dispatcher,
provider builder and parser. It does not introduce a task queue or executor.
The unchanged managed-auth guard is pinned by the installer.

After existing bootstrap overlays, run `node scripts/apply-native-coordinator.mjs`.
The installer accepts only the exact base or complete patched state; drift,
partial installation and symlinked destinations fail before installation.

The supported configuration is `adapterType: paperclip_runner`, Codex provider,
`codexPermissionMode: never`, `disableCommandExecution: true`,
`dangerouslyBypassApprovalsAndSandbox: false`, and
`nativeCoordinator: { version: 1, projectIds: [<authorized project UUIDs>] }`.
The actor must still be the current CEO on an active assigned run. Only local
runnerd execution is admitted; explicit alternate backends, remote targets,
native completion-review mode and managed GitHub activation are denied.
Configuration is an administrator operation, not a model argument.

The exact semantic tool set is: get_task_context, get_task_history, search_tasks,
list_projects, list_agents, get_agent, list_documents, read_document,
list_document_revisions, create_task, reassign_task, set_dependencies,
report_progress, write_document, request_human_input. Native `paperclip_finish`
retains its existing lifecycle contract. Generic API, hiring, skill/instruction
mutation, connections, assigned MCP and connector catalogs are excluded.

Five existing read tools accept optional `targetTaskId` only in this restricted
mode. Current database identity, company/project scope and stock read authority
are checked; writes remain bound to the active task. Target blockers and creation
receipt replays are revalidated inside existing transactions. Role demotion,
pause, project removal, stale ownership and terminal runs revoke calls.

The native input parser preserves the typed policy on persistence/reparse. The
stock session digest already includes the provider, so policy changes rotate
subsequent admissions without changing ordinary native session digests. Deployment
must retire incompatible processes; changing a digest does not revoke a process
already running. Keep agents paused during installation.

Qualification uses the existing installed host and Vitest dependencies in a clean
disposable image. Run `tests/qualify-native-coordinator.mjs` with
`QUALIFY_DISPOSABLE=1`, Docker network disabled, nonroot, read-only root, dropped
capabilities, no-new-privileges, bounded scratch/resources and **no mounts or
credentials**. It creates synthetic PostgreSQL through the existing upstream test
helper. Codex feature inspection uses a new empty home and performs no inference.
Actual model-visible tool exposure and autonomous continuation require a separate
bounded native acceptance run; structural/unit passes do not claim that outcome.

DFW candidate review remains a distinct exact-hash contract on its configured
producer and reviewer issues. Do not put a same-issue reassignment policy on the
DFW producer issue or treat native completion as domain/human acceptance. New
funding cases still require trusted admitted case configuration. Shared-project
reads do not grant external submission, credentials or private-data access.
