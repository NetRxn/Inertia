# Owner-file objective intake and protected native context

This completes the local composition of the existing objective intake contract. It does not introduce another coordinator, task queue, live website connector, credential, deployment, or permission grant. Website/export owners still own source content, Paperclip owns task state, and the existing native coordinator owns prioritization, delegation, review, and results.

## Registration and activation

The plugin registers a manual `reconcile-objective-sources` job and the `objective_source_context` native tool. Registration is disabled by default. There is no recurring schedule; the job rejects non-manual triggers without reading sources or mutating native work. The worker reads `objectiveIntake` from each company's administrator-controlled configuration. Company identity comes from the native host, not configuration, the file, or model parameters.

Example of an explicitly admitted local configuration:

```json
{
  "objectiveIntake": {
    "enabled": true,
    "sourceMode": "owner-file",
    "organizationId": "organization-id",
    "projectId": "native-project-id",
    "intakeAgentId": "native-ceo-agent-id",
    "sources": [
      {
        "sourceSystem": "owner-export",
        "sourceId": "objective-1",
        "path": "/var/lib/inertia/owner-sources/objective-1.json",
        "allowedAgentIds": ["native-ceo-agent-id", "native-researcher-agent-id"],
        "allowedAudiences": ["members"]
      }
    ]
  }
}
```

This is an example, not configured authority. The administrator must verify the actual organization, native company/project/agent identities, source-owner permission, and each agent's access before enabling it. The intake agent must be included in every source's explicit agent list. Delegation alone does not grant source access to another agent. Public source content also requires a configured, authenticated assigned native run.

`owner-file` accepts an owner-provided real export or a synthetic test fixture. It does not claim live source validation. The owner must keep the file current and remove/revoke access promptly; offline code cannot discover remote membership changes that have not reached this owner-controlled source/configuration.

## Protected local input

Each file is the exact `ObjectiveSubmission` object described in `objective-intake.md`: source identity, organization, original author/title/text, audience, opaque revision, digest, prior digest, and withdrawal flag. `objectiveHash` binds all fields except `sourceHash`. The adapter rejects extra authority fields, foreign source/organization identities, invalid digests or shapes, and audiences not explicitly admitted. Revisions are opaque and never lexically ordered.

The path is pinned by the administrator, never supplied to the native tool. The file must be an absolute normalized path without symlinks, owned by the worker's operating-system user, and inaccessible to group/other users (for example mode 0600). Store it outside all model/agent-writable workspaces on a protected owner-managed volume. File permissions do not isolate processes sharing the same operating-system identity; deployments must supply that boundary. Updating the file atomically is supported; a replacement or mutation during a read conservatively suppresses that read and can be retried manually.

Objective reads are bounded to 1 MiB, regular files only, with stable descriptor/path inode, size, and timestamp checks. Invalid UTF-8, JSON, inaccessible files, symlink/special-file substitutions, permission changes, or revoked configuration return no source content. `readOwnerSourceJson` is the reusable internal bounded reader; callers must additionally enforce their own schema and current authority. Its optional limit is capped at 8 MiB. It does not authorize a path on its own.

## One durable mapping, one native task

The manual job composes `ingestObjective`, `createIntakeStore`, and `createNativeObjectiveAdapter`; migration 007 remains the private SQL mapping/history store. No new public snapshot store or competing queue is introduced. Replays, corrections, expected-previous-hash conflicts, uncertain native outcomes, and withdrawals retain the existing CAS and reconciliation semantics.

The native adapter is wrapped only to pin the configured project, verify company/project on readback, and include a generic pointer to `objective_source_context`. A new objective remains an assigned native backlog item. The existing coordinator activates and decomposes it under its mandate; this intake job does not start a model, create a reviewer, hire an agent, or install a heartbeat. Later source updates preserve task priority, assignment, hierarchy, and status, except that a withdrawal cancels the linked task. An uncertain operation is not automatically retried as a new issue.

Native titles/descriptions contain generic intake instructions, opaque origin/revision markers, and a protected-tool pointer. They do not receive source text, author attribution, or owner-file paths. The exact source snapshot/history stays in the plugin's private SQL namespace and the owner-controlled source.

## Authenticated source resolution

`objective_source_context` accepts only `{}`. Company, project, agent, and run come from the host's `ToolRunContext`; source identity, path, organization, and permission lists come from current administrator configuration. There is no model-supplied audience or principal assertion.

The resolver checks:

1. Exactly one nonpending source-to-native mapping, its digest/version marker, native origin, company, and project.
2. Current native root/subtree and parent-chain membership, an explicitly source-admitted agent, the actual assigned task, and an active running native run. Unrelated tasks, queued/finished runs, paused agents, terminal tasks, stale assignment, and forged run IDs fail closed.
3. The shared `assertNativeTaskRun` guard before `assertCheckoutOwner`. Checkout may adopt stale/unowned work and is not an authentication mechanism.
4. Current configuration, exact mapping, ancestry, assignment, active run, source revision, audience, and withdrawal before and after protected file reads. A source or native access change during the call withholds the result.
5. The existing `projectObjectiveProgress` read-through projection against the same authorized current source and native marker. The audience is the checked source audience, not a caller argument.

The result includes the original source, its digest/revision/attribution, the root objective ID, the assigned task ID, and permitted native progress. An explicit instruction labels source text as untrusted data, not instructions or action authority. It creates no native document, comment, external disclosure, grant application, adopted motion, or human approval. Agent results/review continue through existing native tools and workflows.

## Verification and remaining gates

Focused tests exercise the real pinned SDK harness for registration, native issue creation/update, subtree membership and checkout, alongside real PGlite SQL for mapping history/restart behavior. The SDK harness cannot seed active runs, so tests supply only deterministic host run/assignee readback while retaining its real issue/subtree/checkout implementation. Fixture records are synthetic, not owner-authorized production records.

Coverage includes disabled/no-network operation, manual-only triggers, protected filesystem inputs, malformed/foreign source rejection, exact hash/revision handling, restart and correction deduplication, source withdrawal/audience narrowing, wrong company/project/agent/run, queued/finished/paused/reassigned work, admitted delegation versus unrelated tasks, source and assignment races, duplicate native origins, and source/model authority injection. These focused checks are not full-system or live-provider qualification.

Production activation still requires owner source/export admission, verified current membership and audience policy, native tool/run-log visibility appropriate to the protected source, native origin/subtree/run-readback qualification, private database role/retention controls, a protected persistent source volume, and a separately authorized live connector if desired. Local source reads plus actual SQL do not prove a deployed website integration, provider execution, or end-to-end production completion.
