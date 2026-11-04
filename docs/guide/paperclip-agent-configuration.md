# Configure Inertia agents in Paperclip

This cheat sheet applies to Inertia's pinned Paperclip deployment. Use an agent's **Runtime** settings for model and connection changes, and its reporting settings for hierarchy changes. Treat those as separate edits and verify a run after each.

| Change | What to set | What to verify |
| --- | --- | --- |
| Add a general-purpose agent | Give it a manager, project, workspace, and its own approved AI connection. Start with only the tools its role needs. | Assign a small issue in that project. Verify a saved result and, if the job needs shell access, a harmless command in its assigned workspace. |
| Change a funding agent's model | Keep **Paperclip Runner** as the adapter and **Codex** as the provider. Edit the model in place. Preserve the native lifecycle, project bindings, tool grants, and connection policy. | The run is native, has the expected issue and project, and completes an assigned funding tool call. A text reply only verifies model access. |
| Change a model connection | Check the agent's connection selector and the issue's responsible user. For **Responsible user's default**, the user needs a compatible personal default installed for that agent. | Run a small task as that user. The Codex adapter label alone does not identify the OpenAI account. |
| Assign or move funding work | Use the existing funding portfolio and its Coordinator. Wait for active runs to finish before moving issues across projects. | A fresh run has the new project's context. A running task's gateway token is bound to its original project. |
| Recover from a bad runtime edit | Compare with the last working agent configuration revision. Restore the narrow change. For revisions with redacted secrets, use the supported update flow that preserves existing values. | Read back the adapter and config, then verify a fresh native run. Preserve the issue history and active recovery records. |

[Paperclip agent settings](https://docs.paperclip.ing/guides/org/agents/) · [OpenAI connection assignment](https://docs.paperclip.ing/connectors/openai/#assign-the-credential)

## Add a CEO and C-suite

Inertia's native Coordinator policy currently checks the Coordinator's `ceo` role, `paperclip_runner` adapter, assigned issue, and allowed projects. Treat moving it below a new CEO as a runtime authorization migration. First qualify the existing Coordinator identity in its new role with the same scoped grants. Then update its reporting line and add CFO and CTO as peers. Keep existing case assignments and independent review responsibilities attached to the funding agents. [Paperclip org structure](https://docs.paperclip.ing/guides/org/org-structure/)

## Keep funding moving

Keep **Wake on demand** enabled. Let assignments and dependency handbacks wake workers. For periodic discovery and queue reconciliation, qualify one Coordinator routine against the existing portfolio. It should coalesce overlapping runs, skip active work, preserve genuine holds, and dispatch only eligible tasks. Verify the scout and its handback before enabling a recurring trigger. [Paperclip heartbeats and routines](https://docs.paperclip.ing/guides/projects-workflow/routines/)

## Read the first failure

| Signal | Check |
| --- | --- |
| `gateway_token_run_context_invalid` | Compare the run's assigned issue/project to the issue now. A project move during a run can invalidate the old context. |
| Funding scope denied | Check for native runtime, the configured actor and project, and the existing portfolio lineage. A direct Codex run can finish without native funding access. |
| `public_scout_fresh_workspace_required` | The native scout requires a canonical empty workspace with no ancestor agent instructions. A shared project directory can start empty and gain runtime directories on its first run. Reusing it then fails admission. Preserve the shared directory and fix scout workspace selection. |
| Bubblewrap root-bind denial | Check the adapter and sandbox profile. The legacy ACP sandbox policy can request a root bind that Inertia's enforcing profile denies. |
| `model_not_found` | Check the installed CLI and ACP versions, selected model, and resolved connection. This error reports model availability. |

[Inertia release and recovery](release.md)
